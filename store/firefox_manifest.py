"""Rewrite a staged Chrome manifest into the Firefox one. Called by build.sh."""
import json, sys

path = sys.argv[1]
m = json.load(open(path))

# Firefox uses an event page, and loads config.js as a script rather than via
# importScripts, which does not exist outside a service worker.
m["background"] = {"scripts": ["config.js", "background.js"]}

# options_page is only honoured from Firefox 126. options_ui goes back much further, so
# using it keeps the minimum at 115 (which is what storage.session needs) rather than
# excluding every Firefox between the two.
m.pop("options_page", None)
m["options_ui"] = {"page": "control.html", "open_in_tab": True}

m["browser_specific_settings"] = {
    "gecko": {
        "id": "baitblocker@baitblocker.org",
        # storage.session landed in Firefox 115; the badge and popup both depend on it.
        "strict_min_version": "115.0",
        # Firefox now requires new extensions to declare what they collect. Nothing here
        # leaves the browser, so the answer is "none".
        #
        # This leaves web-ext lint with two warnings, deliberately: the key itself is only
        # understood from Firefox 140 (Android 142), and the minimum here is 115. Raising
        # the minimum would clear the warnings by excluding every Firefox between the two.
        # Older versions ignore manifest keys they do not recognise, so nothing breaks,
        # and AMO blocks on errors rather than warnings.
        "data_collection_permissions": {"required": ["none"]},
    }
}

with open(path, "w") as handle:
    json.dump(m, handle, indent=2, ensure_ascii=False)
    handle.write("\n")
