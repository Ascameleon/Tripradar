import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")

class StructureParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.forms = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "form":
            self.forms += 1

class TripRadarSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parser = StructureParser()
        cls.parser.feed(HTML)

    def test_required_ui_sections_exist(self):
        for element_id in ("searchForm", "origin", "dateFrom", "dateTo", "budget",
                           "results", "empty", "savedList", "favCount", "toast",
                           "destinationFilter", "sortBy"):
            with self.subTest(element_id=element_id):
                self.assertIn(element_id, self.parser.ids)

    def test_search_form_and_script_exist(self):
        self.assertEqual(self.parser.forms, 1)
        self.assertIn('addEventListener("submit"', HTML)
        self.assertIn('localStorage.setItem("tripradar-favorites"', HTML)

    def test_prices_are_explicitly_marked_as_demo(self):
        self.assertIn("prix affichés sont des exemples de démonstration", HTML)
        self.assertIn("Prix de démonstration", HTML)

    def test_destination_data_is_sorted_by_price(self):
        self.assertIn('list.sort((a,b)=>sort==="price-desc"?b.price-a.price:sort==="name"?a.city.localeCompare(b.city,"fr"):a.price-b.price)', HTML)
        prices = [int(x) for x in re.findall(r'country:"[^"]+",price:(\d+)', HTML)]
        self.assertGreaterEqual(len(prices), 5)
        self.assertEqual(prices, sorted(prices))

    def test_destination_filters_and_hotel_links_are_wired(self):
        self.assertIn('sort==="price-desc"', HTML)
        self.assertIn('addEventListener("input",render)', HTML)
        self.assertIn('data-stay=', HTML)
        self.assertIn('bookingUrl.searchParams.set("ss",destination.city)', HTML)
        self.assertIn('bookingUrl.searchParams.set("checkin",from)', HTML)
        self.assertIn('bookingUrl.searchParams.set("checkout",to)', HTML)
        self.assertIn('https://www.booking.com/searchresults.html', HTML)

    def test_installable_offline_app_files_are_wired(self):
        self.assertIn('rel="manifest" href="./manifest.webmanifest"', HTML)
        self.assertIn('navigator.serviceWorker.register("./sw.js")', HTML)
        self.assertTrue((ROOT / "manifest.webmanifest").is_file())
        self.assertTrue((ROOT / "sw.js").is_file())
        self.assertTrue((ROOT / "icon.svg").is_file())

    def test_no_inline_event_attributes(self):
        self.assertNotRegex(HTML, r'\son(?:click|submit|change)\s*=')

if __name__ == "__main__":
    unittest.main(verbosity=2)
