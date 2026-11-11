-- Sync verified public Google Play catalog, 11 November 2026.
-- Preserve stock, assignments, QR links and existing activation settings.
begin;
insert into exclusive_private.watchfaces(id,package_name,name,description,image) values
('artemis2celebration','com.watchfacestudio.artemis2celebration','Artemis II Moon Phase Digital','A moon phase watch face with digital time, weather forecasts and world time','/products/artemis2celebration-verified.webp'),
('cyber','com.watchfacestudio.cyber','Cyber Mechanica Watch Face','Futuristic watch face for Wear OS with weather, steps and three color styles','/products/cyber-verified.webp'),
('flat-earth','com.watchfacestudio.terrapiatta','Flat Earth Animated Watch Face','An animated flat world for Wear OS, with moon phases, weather and wrist motion','/products/new-releases/flat-earth-dial.webp'),
('gearweirdo','com.watchfacestudio.gearweirdo','GEAR Weirdo Analog Watch Face','Mechanical watch face for Wear OS with Weirdo mode that swaps the time scales','/products/gearweirdo-verified.webp'),
('grunge-rock','com.watchfacestudio.grungemythsrock','Grunge Rock Watch Face','watch face with grunge textures and interchangeable music legend portraits.','/products/new-releases/grunge-rock-dial.webp'),
('kanji-wave','com.watchfacestudio.nihongotimewatch','Kanji Wave Japanese Watch Face','Japanese kanji time, parallax waves, weather and liquid step-goal animation.','/products/kanji-wave-blue.png'),
('lavaorange','com.watchfacestudio.lavaorange','Lava Lamp Orange Watch Face','Animated lava lamp watch face for Wear OS, with retro style, weather and steps','/products/lavaorange-verified.webp'),
('violetlava','com.watchfacestudio.violetlava','Lava Lamp Violet Watch Face','Retro lava lamp watch face for Wear OS, with violet animation and daily phrases','/products/violetlava-verified.webp'),
('long-distance-call','com.watchfacestudio.longdistancecall','Long Distance Call Watch Face','Wear OS watch face with favorite contacts, world clocks and a day-night sky','/products/new-releases/long-distance-call-dial.webp'),
('megastructure','com.watchfacestudio.blamelike','Megastructure Cyberpunk Face','Animated cyberpunk weather watch face for Wear OS, with a living sci-fi city.','/products/new-releases/megastructure-dial.webp'),
('outfit','com.watchfacestudio.steely','Outfit: Wear OS Watch Face','Elegant analog watch face for Wear OS with 10 colours and useful daily details.','/products/outfit-real-colours.gif'),
('r4star','com.watchfacestudio.r4star','R4 Star Analog Watch Face','Vintage analog watch face for Wear OS with gold hands and a distinctive red star','/products/r4star-verified.webp'),
('R5S','com.watchfacestudio.R5S','R5S: Soviet Pilot Watch Face','Vintage pilot watch face for Wear OS with step progress and customizable colors','/products/R5S-verified.webp'),
('solar-flare','com.watchfacestudio.spacesolarflare','Solar Flare Space Watch Face','Animated space watch face with solar flares, Earth, Moon and Big Dipper steps.','/products/new-releases/solar-flare-dial.webp'),
('sputnik','com.watchfacestudio.sputnik','Sputnik Animated Watch Face','Animated space watch face with orbiting satellite, weather, steps and calendar','/products/sputnik-verified.webp'),
('ukiyo-wave','com.watchfacestudio.japdigkanjiwave','Ukiyo Wave Japanese Watch Face','Japanese art, Arabic numerals, parallax waves, animated steps and weather.','/products/ukiyo-wave-blue.png'),
('voyageranalog','com.watchfacestudio.voyageranalog','Voyager Analog Watch Face','Animated analog space watch face with Golden Record art and world time','/products/voyager-analog-verified.webp'),
('voyagerdigital','com.watchfacestudio.voyagerdigital','Voyager Digital Watch Face','Animated digital space watch face with Golden Record art and world time','/products/voyager-digital-verified.webp'),
('zodiac10','com.watchfacestudio.zodiac10','Zodiac Astrology Watch Face','Zodiac watch face with a changing ring, constellations and named moon phases','/products/zodiac10-verified.webp')
on conflict(package_name) do update set name=excluded.name, description=excluded.description, image=excluded.image;
commit;
