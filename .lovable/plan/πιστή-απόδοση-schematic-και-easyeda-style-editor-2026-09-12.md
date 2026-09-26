# Πιστή απόδοση schematic και EasyEDA-style editor

## Αποτέλεσμα
- Ο editor θα αναπαράγει τη γεωμετρία που αναγνωρίζεται στην εικόνα: θέση, περιστροφή, τύπο συμβόλου, άκρα pins, γωνίες καλωδίων, junctions και labels.
- Όλες οι προεπισκοπήσεις θα χρησιμοποιούν την ίδια κεντρική βιβλιοθήκη συμβόλων, ώστε resistor, capacitor, diode, transistor, IC, relay, connector κ.λπ. να αποδίδονται σταθερά και όχι με διαφορετικό fallback ανά οθόνη.
- Η επιφάνεια εργασίας θα αποκτήσει πυκνή, επαγγελματική διάταξη τύπου EasyEDA, με λευκό καμβά, αριστερή βιβλιοθήκη, επάνω εργαλεία, δεξί inspector και κάτω status bar.
- Τα τέσσερα κουμπιά pan με βέλη θα αφαιρεθούν. Το pan θα παραμείνει με drag σε κενό καμβά/μεσαίο πλήκτρο ή space+drag, όπως σε schematic editor.

## Ακριβής ανάγνωση από την εικόνα
- Επέκταση του αποτελέσματος αναγνώρισης με `symbolKind`, bounding box/μέγεθος, ακριβή pin anchors και πολυγραμμές καλωδίων σε κανονικοποιημένες συντεταγμένες.
- Δεύτερος οπτικός έλεγχος που θα συγκρίνει ρητά πλήθος συμβόλων, προσανατολισμό, pin endpoints, junction dots και wire turns με την αρχική εικόνα.
- Διατήρηση των αρχικών συντεταγμένων στον editor αντί για αναδιάταξη σε σειρές ή κοινό κάθετο trunk. Αυτόματο routing θα χρησιμοποιείται μόνο για παλιά projects ή δεδομένα χωρίς αναγνωρισμένη γεωμετρία.
- Τα χειροκίνητα drag/rotate θα ενημερώνουν τη γεωμετρία χωρίς να καταστρέφουν τις υπόλοιπες διαδρομές.

## Πρότυπη βιβλιοθήκη συμβόλων
- Δημιουργία μίας επαναχρησιμοποιήσιμης βιβλιοθήκης SVG συμβόλων βασισμένης στις συνήθεις ANSI/IEC μορφές που χρησιμοποιεί και το EasyEDA, χωρίς αντιγραφή ιδιόκτητων assets.
- Κάλυψη resistor IEC/ANSI, capacitor/polarized capacitor, inductor, diode/LED/Zener/Schottky, BJT NPN/PNP, NMOS/PMOS, op-amp, IC, relay, switch, crystal, ground/power και connectors.
- Χρήση της ίδιας βιβλιοθήκης στον Component Editor και στις προεπισκοπήσεις KiCad/EAGLE. Άγνωστο component θα εμφανίζεται ως σαφές generic IC και όχι ως λανθασμένο γνωστό σύμβολο.

## Interface editor
- Αναδιάταξη του editor σε full-width workspace με compact toolbar, πραγματικό schematic canvas, αριστερό component browser και δεξί properties panel.
- Zoom με κουμπιά/τροχό, pan με canvas gesture και επιλογή/μετακίνηση με snap grid.
- Επιλεγμένο στοιχείο, wire και pin θα έχουν σαφή EasyEDA-like states, χωρίς τα σημερινά μεγάλα mobile controls που πιέζουν τον καμβά.
- Σε κινητό, οι πλευρικές περιοχές θα ανοίγουν ως drawers ώστε ο καμβάς να διατηρεί χρήσιμο πλάτος.

## Συμβατότητα και έλεγχοι
- Μετατροπή παλιών αποθηκευμένων netlists στη νέα γεωμετρία με ασφαλές fallback.
- Regression tests για symbol mapping, orientation, exact source coordinates, pin anchors, wire polylines και fallback routing.
- Έλεγχος ότι EasyEDA/KiCad/EAGLE exports παραμένουν verified και ότι ο editor λειτουργεί σε desktop και στο τρέχον mobile μέγεθος χωρίς overflow.

## Τεχνική σημείωση
Η οπτική πιστότητα εξαρτάται από όσα μπορούν να διαβαστούν καθαρά στην εικόνα. Ο editor θα διατηρεί πλέον την αναγνωρισμένη γεωμετρία αντί να την αντικαθιστά με νέο αυτόματο layout, ενώ ο υπάρχων αυτόματος αλγόριθμος θα παραμένει fallback.

