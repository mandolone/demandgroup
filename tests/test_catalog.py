import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import sync_catalog as catalog

PACKAGE = "com.watchfacestudio.steely"
LISTING = '''<a href="/store/apps/dev?id=6965957154471594542">Demand Group</a>
<meta property="og:url" content="https://play.google.com/store/apps/details?id=com.watchfacestudio.steely&amp;hl=en">
<meta property="og:title" content="Outfit &amp; Time - Apps on Google Play">
<meta property="og:description" content="An analog watch face.">
<meta property="og:image" content="https://play-lh.googleusercontent.com/example=s0-br30">'''


class CatalogTests(unittest.TestCase):
    def app(self):
        return catalog.parse_app(PACKAGE, LISTING)

    def test_metadata_entities_and_image_size(self):
        app = self.app()
        self.assertEqual(app["title"], "Outfit & Time")
        self.assertEqual(app["imageUrl"], "https://play-lh.googleusercontent.com/example=s512-rw")

    def test_reject_other_developer(self):
        with self.assertRaisesRegex(ValueError, "developer"):
            catalog.parse_app(PACKAGE, LISTING.replace(catalog.DEVELOPER_ID, "123"))

    def test_reject_wrong_app(self):
        with self.assertRaisesRegex(ValueError, "canonical"):
            catalog.parse_app("com.watchfacestudio.other", LISTING)

    def test_empty_discovery_does_not_become_empty_catalog(self):
        with self.assertRaisesRegex(ValueError, "no apps"):
            catalog.discover_packages("<html>Consent or error page</html>")

    def test_discovery_only_uses_play_app_links(self):
        source = '<a href="/store/apps/details?id=com.watchfacestudio.steely&amp;hl=en">App</a><a href="https://evil.example/store/apps/details?id=com.watchfacestudio.fake">Fake</a>'
        self.assertEqual(catalog.discover_packages(source), {PACKAGE})

    def test_unchanged_catalog_preserves_timestamp(self):
        previous = {"schemaVersion": 1, "updatedAt": "2026-09-24T17:17:00Z", "apps": [self.app()]}
        self.assertEqual(catalog.make_catalog([self.app()], previous), previous)

    def test_reject_empty_duplicate_and_insecure_image(self):
        valid = catalog.make_catalog([self.app()])
        for apps in ([], [self.app(), self.app()], [{**self.app(), "imageUrl": "http://example.com/icon.png"}]):
            invalid = copy.deepcopy(valid)
            invalid["apps"] = apps
            with self.assertRaises(ValueError):
                catalog.validate_catalog(invalid)

    def test_network_failure_preserves_both_published_copies(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outputs = (root / "docs/catalog/watchfaces.json", root / "public/catalog/watchfaces.json")
            payload = json.dumps(catalog.make_catalog([self.app()]))
            for output in outputs:
                output.parent.mkdir(parents=True)
                output.write_text(payload)
            with patch.object(catalog, "ROOT", root), patch.object(catalog, "OUTPUTS", outputs), patch.object(catalog, "fetch", side_effect=TimeoutError("offline")):
                with self.assertRaises(TimeoutError):
                    catalog.sync()
            for output in outputs:
                self.assertEqual(output.read_text(), payload)

    def test_404_retries_second_market(self):
        unavailable = HTTPError("https://play.google.com", 404, "Not found", {}, None)
        with patch.object(catalog, "fetch", side_effect=[unavailable, LISTING]) as fetch:
            self.assertEqual(catalog.load_app(PACKAGE), self.app())
            self.assertIn("gl=IT", fetch.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
