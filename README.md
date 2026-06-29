# WC2026 Predictions Platform — V19

Αλλαγή V19:

- Το section «Επόμενα ματς» προσπαθεί πρώτα να φορτώσει fixtures από το FIFA calendar API.
- Προστέθηκαν πολλαπλές δοκιμές φόρτωσης: direct FIFA, AllOrigins proxy και corsproxy.io, επειδή σε GitHub Pages το browser fetch μπορεί να μπλοκαριστεί από CORS.
- Αν δεν φορτώσει η FIFA, εμφανίζεται καθαρό μήνυμα σφάλματος αντί να δείχνει παραπλανητικό ζευγάρι από τη στήλη G.
- Βελτιώθηκε η ανάγνωση ονομάτων ομάδων, ημερομηνιών, φάσεων και γηπέδων από το FIFA JSON.

Ανέβασε στο GitHub τα αρχεία:

- index.html
- app.js
- style.css

Μετά κάνε hard refresh: Ctrl + F5.
