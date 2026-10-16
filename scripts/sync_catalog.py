#!/usr/bin/env python3
"""Publish the companion catalog from public Demand Group Google Play listings."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEVELOPER_ID = "6965957154471594542"
PLAY = "https://play.google.com"
OUTPUTS = (ROOT / "docs/catalog/watchfaces.json", ROOT / "public/catalog/watchfaces.json")
PACKAGE = re.compile(r"com\.watchfacestudio\.[A-Za-z0-9_]+\Z")


class PlayPage(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {}
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            self.meta[attrs.get("property", attrs.get("name", ""))] = attrs.get("content", "")
        if tag == "a" and "href" in attrs:
            self.links.append(attrs["href"])


def parse_page(source):
    page = PlayPage()
    page.feed(source)
    return page


def discover_packages(source):
    packages = set()
    for link in parse_page(source).links:
        url = urlparse(link)
        if url.path == "/store/apps/details" and url.netloc in ("", "play.google.com"):
            package = parse_qs(url.query).get("id", [""])[0]
            if PACKAGE.fullmatch(package):
                packages.add(package)
    if not packages:
        raise ValueError("Google Play returned no apps; refusing to replace the catalog")
    return packages


def parse_app(package, source):
    page = parse_page(source)
    owner = any(
        urlparse(link).path == "/store/apps/dev"
        and urlparse(link).netloc in ("", "play.google.com")
        and parse_qs(urlparse(link).query).get("id") == [DEVELOPER_ID]
        for link in page.links
    )
    if not owner:
        raise ValueError(f"{package}: Demand Group developer link missing")
    title = page.meta.get("og:title", "").removesuffix(" - Apps on Google Play").strip()
    description = page.meta.get("og:description", "").strip()
    image = page.meta.get("og:image", "").strip()
    image_url = urlparse(image)
    canonical = urlparse(page.meta.get("og:url", ""))
    if parse_qs(canonical.query).get("id") != [package]:
        raise ValueError(f"{package}: unexpected canonical listing")
    if not title or not description or image_url.scheme != "https" or image_url.netloc != "play-lh.googleusercontent.com":
        raise ValueError(f"{package}: incomplete listing metadata")
    # Use a reasonably sized official icon rather than the original full-size image.
    image = image.split("=", 1)[0] + "=s512-rw"
    return {"packageName": package, "title": title, "shortDescription": description, "imageUrl": image}


def fetch(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; DemandGroupCatalog/1.0)", "Accept-Language": "en-US,en;q=0.9"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=35) as response:
                if response.status != 200:
                    raise ValueError(f"Unexpected HTTP {response.status}: {url}")
                return response.read().decode("utf-8")
        except HTTPError as error:
            if error.code == 404:
                raise
            if attempt == 2:
                raise
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)


def load_app(package):
    # Check a second market before excluding an unavailable app.
    for market in ("US", "IT"):
        url = PLAY + "/store/apps/details?" + urlencode({"id": package, "hl": "en", "gl": market})
        try:
            return parse_app(package, fetch(url))
        except HTTPError as error:
            if error.code != 404:
                raise
    print(f"Unavailable in US and IT, excluded: {package}", file=sys.stderr)
    return None


def validate_catalog(catalog):
    if type(catalog.get("schemaVersion")) is not int or catalog["schemaVersion"] != 1:
        raise ValueError("Unsupported schemaVersion")
    datetime.fromisoformat(catalog["updatedAt"].replace("Z", "+00:00"))
    apps = catalog["apps"]
    if not isinstance(apps, list) or not apps:
        raise ValueError("Empty catalog")
    packages = set()
    for app in apps:
        package = app["packageName"]
        if not PACKAGE.fullmatch(package) or package in packages:
            raise ValueError(f"Invalid or duplicate package: {package}")
        packages.add(package)
        for field in ("title", "shortDescription", "imageUrl"):
            if not isinstance(app[field], str) or not app[field].strip():
                raise ValueError(f"Missing {field}: {package}")
        image = urlparse(app["imageUrl"])
        if image.scheme != "https" or image.netloc != "play-lh.googleusercontent.com":
            raise ValueError(f"Invalid image URL: {package}")


def make_catalog(apps, previous=None):
    apps = sorted(apps, key=lambda app: (app["title"].casefold(), app["packageName"]))
    if previous and previous.get("schemaVersion") == 1 and previous.get("apps") == apps:
        return previous
    return {"schemaVersion": 1, "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"), "apps": apps}


def sync():
    previous = json.loads(OUTPUTS[0].read_text()) if OUTPUTS[0].exists() else None
    discovered = set()
    for market in ("US", "IT"):
        url = PLAY + "/store/apps/dev?" + urlencode({"id": DEVELOPER_ID, "hl": "en", "gl": market})
        discovered.update(discover_packages(fetch(url)))
    # Also recheck known apps: developer listings can omit apps by region.
    candidates = discovered | {app["packageName"] for app in (previous or {}).get("apps", [])}
    index = ROOT / "docs/index.html"
    if index.exists():
        candidates.update(re.findall(r"https://play\.google\.com/store/apps/details\?id=(com\.watchfacestudio\.[A-Za-z0-9_]+)", index.read_text()))
    with ThreadPoolExecutor(max_workers=4) as pool:
        apps = [app for app in pool.map(load_app, sorted(candidates)) if app is not None]
    actual = {app["packageName"] for app in apps}
    if not discovered.issubset(actual):
        raise ValueError("An app advertised by the developer listing is unavailable; keeping previous catalog")
    catalog = make_catalog(apps, previous)
    validate_catalog(catalog)
    payload = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    # All requests and validation finish before either published copy is touched.
    for output in OUTPUTS:
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix(".json.tmp")
        temporary.write_text(payload, encoding="utf-8")
        temporary.replace(output)
    print(f"Catalog valid: {len(apps)} apps, updatedAt={catalog['updatedAt']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate both committed copies without network access")
    args = parser.parse_args()
    if args.check:
        for output in OUTPUTS:
            validate_catalog(json.loads(output.read_text()))
        if OUTPUTS[0].read_bytes() != OUTPUTS[1].read_bytes():
            raise ValueError("docs and public catalog copies differ")
        print("Both catalog copies are valid and identical")
    else:
        sync()


if __name__ == "__main__":
    main()
