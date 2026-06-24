# WC2026 Predictions League — V13

Fixes:
- Ο 1ος σκόρερ πλέον εμφανίζει όλες τις επιλογές, όχι μόνο Top 8.
- Δεν φιλτράρει ονόματα που ξεκινούν από Χ, π.χ. ΧΑΑΛΑΝΤ.
- Προστέθηκε normalization για ΕΜΠΑΠΕ / ΧΑΑΛΑΝΤ παραλλαγές.

# WC2026 Predictions League — V10

Fix αποτελεσμάτων ισοπαλίας.

## Fix
- Το φύλλο `ΑΠΟΤΕΛΕΣΜΑΤΑ` πλέον διαβάζεται με `export?format=csv&gid=1805121888` αντί για `gviz/tq`.
- Αυτό διορθώνει το πρόβλημα όπου τα `X` στη στήλη E εμφανίζονταν ως κενά λόγω Google type inference.
- Το Match Center εμφανίζει: `27/32 σωστές προβλέψεις`.

Ανεβάστε τα 4 αρχεία στο GitHub repository.


## V13
- Added Upcoming Picks section below the podium.
- Shows 1/X/2 distribution for upcoming group-stage matches.
- Click any outcome to see which players selected it.


## V13
- Upcoming Picks: οι καρτέλες παικτών διαβάζονται με raw CSV export ώστε οι προβλέψεις X/Χ να μη χάνονται από το Google type inference.
