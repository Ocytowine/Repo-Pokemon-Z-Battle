# Inventaire des objets tenus appelés par `hasWorkingItem`

Extraction des appels littéraux Ruby de `.pokemon-z/data/scripts/*.rb` le 2026-10-26.
Ce relevé contient **203 noms distincts** et **448 appels**. Il constitue un périmètre
d’audit des hooks ; les objets sans cet appel et les effets hors combat exigent
un inventaire complémentaire. Les références du seul Lancer ne prouvent pas
qu’un effet tenu fonctionne.

**Compteur global minimal vérifié : 138/906 objets portés.** Le catalogue
`items.json` contient 906 objets. Les 95 noms distincts supportés par les
cinq familles d'`item-coverage-report.json` et 43 objets tenus supplémentaires
ci-dessous n'ont aucun doublon. Les autres objets ne sont pas tous absents :
la vérification globale doit continuer avant de calculer le total définitif.

**Objets tenus validés dans ce relevé : 75/203 ; 128/203 à auditer.**
« À auditer » ne signifie pas « non porté » : plusieurs noms ont déjà du code,
mais leurs hooks ne sont pas tous rapprochés du Ruby. Le compteur mondial
« portés / non portés » reste donc indéterminé.

- `Plaques` : 18 objets, type de Jugement, forme Arceus, protection contre le retrait et bonus de dégâts source de 25 % ; tests noyau simple et Duo, room hôte/invité et restauration existants.
- `Lot ciblé` : 14 objets du relevé prioritaire, portés dans les lots précédents, dont Carte Rouge et Bouton Fuite.
- `Herbe Pouvoir` : 16 fonctions de charge Ruby vérifiées contre le noyau commun, y compris `14D` et `14E` ; Lancer est déjà répertorié.
- `Cible Anneau` : immunités de type et de statut, Synchro, Statik et Lancer vérifiés.
- `Soin et drain` : Racine Grande, Racine Ancestrale, Restes et Boue Noire vérifiés ; Suintement contre Drenadoras et Soin Bloqué utilisent le noyau commun.
- `Grelot Coque` : soin une fois sur le total des dégâts, après les attaques à plusieurs coups ou cibles, avant le recul de l'Orbe Vie.
- `Réactions et résidus` : Orbe Vie, Casque Brut, Barbule et Bande Étreinte, y compris le contact par coup et l'exception Salaison (`0CF`) sur Eau/Acier.

Les appels d'heuristique IA sont recensés dans les 448 appels Ruby, mais le
compteur vérifié porte sur les effets des objets en combat. Les préférences
IA de Tourmagik/Passe-Passe et l'estimation des dégâts d'Orbe Vie restent
une dette distincte dans la roadmap.

| Objet source | Appels Ruby | État vérifié |
| --- | ---: | --- |
| `ABSORBBULB` | 1 | À auditer par hook |
| `ADAMANTORB` | 2 | À auditer par hook |
| `AGUAVBERRY` | 1 | À auditer par hook |
| `AIRBALLOON` | 8 | À auditer par hook |
| `ANILLODESANGRE` | 1 | Lot ciblé — porté |
| `ANTICRITICO` | 1 | Lot ciblé — porté |
| `APICOTBERRY` | 1 | À auditer par hook |
| `ARMAZONDEFAUCES` | 3 | Lot ciblé — porté |
| `ASPEARBERRY` | 1 | Famille auditée — porté |
| `ASSAULTVEST` | 2 | À auditer par hook |
| `BABIRIBERRY` | 2 | À auditer par hook |
| `BERRYJUICE` | 1 | Famille auditée — porté |
| `BIGROOT` | 7 | Soin et drain — porté |
| `BINDINGBAND` | 1 | Réactions et résidus — porté |
| `BLACKBELT` | 2 | Famille auditée — porté |
| `BLACKGLASSES` | 2 | Famille auditée — porté |
| `BLACKSLUDGE` | 1 | Soin et drain — porté |
| `BRIGHTPOWDER` | 2 | À auditer par hook |
| `BUGGEM` | 2 | À auditer par hook |
| `BURNDRIVE` | 1 | À auditer par hook |
| `CANONDEMANO` | 1 | Lot ciblé — porté |
| `CASCOPROTECTOR` | 6 | À auditer par hook |
| `CELLBATTERY` | 1 | À auditer par hook |
| `CHARCOAL` | 2 | Famille auditée — porté |
| `CHARTIBERRY` | 2 | À auditer par hook |
| `CHERIBERRY` | 1 | Famille auditée — porté |
| `CHESTOBERRY` | 1 | Famille auditée — porté |
| `CHILANBERRY` | 2 | À auditer par hook |
| `CHILLDRIVE` | 1 | À auditer par hook |
| `CHOICEBAND` | 8 | À auditer par hook |
| `CHOICESCARF` | 6 | À auditer par hook |
| `CHOICESPECS` | 7 | À auditer par hook |
| `CHOPLEBERRY` | 2 | À auditer par hook |
| `CLEARAMULET` | 6 | À auditer par hook |
| `COBABERRY` | 2 | À auditer par hook |
| `COLBURBERRY` | 2 | À auditer par hook |
| `CORAZAASALTO` | 2 | Lot ciblé — porté |
| `COVERTCLOAK` | 3 | À auditer par hook |
| `CUSTAPBERRY` | 1 | Famille auditée — porté |
| `DAMPROCK` | 2 | À auditer par hook |
| `DARKGEM` | 2 | À auditer par hook |
| `DEEPSEASCALE` | 2 | À auditer par hook |
| `DEEPSEATOOTH` | 2 | À auditer par hook |
| `DESTINYKNOT` | 2 | Lot ciblé — porté |
| `DOUSEDRIVE` | 1 | À auditer par hook |
| `DRACOPLATE` | 3 | Plaques — porté |
| `DRAGONFANG` | 2 | Famille auditée — porté |
| `DRAGONGEM` | 2 | À auditer par hook |
| `DREADPLATE` | 3 | Plaques — porté |
| `EARTHPLATE` | 3 | Plaques — porté |
| `EJECTBUTTON` | 1 | Lot ciblé — porté |
| `ELECTRICGEM` | 2 | À auditer par hook |
| `ENIGMABERRY` | 1 | À auditer par hook |
| `ESPADAVALIENTE` | 1 | Lot ciblé — porté |
| `EVIOLITE` | 2 | À auditer par hook |
| `EXPERTBELT` | 2 | À auditer par hook |
| `FAIRYGEM` | 1 | À auditer par hook |
| `FIGHTINGGEM` | 2 | À auditer par hook |
| `FIGYBERRY` | 1 | À auditer par hook |
| `FIREGEM` | 2 | À auditer par hook |
| `FISTPLATE` | 3 | Plaques — porté |
| `FLAMEORB` | 4 | À auditer par hook |
| `FLAMEPLATE` | 3 | Plaques — porté |
| `FLOATSTONE` | 2 | À auditer par hook |
| `FLYINGGEM` | 3 | À auditer par hook |
| `FOCUSBAND` | 1 | À auditer par hook |
| `FOCUSSASH` | 1 | À auditer par hook |
| `FUELLENEUMATICO` | 1 | Lot ciblé — porté |
| `FULLINCENSE` | 1 | Famille auditée — porté |
| `GANLONBERRY` | 1 | À auditer par hook |
| `GHOSTGEM` | 2 | À auditer par hook |
| `GRASSGEM` | 2 | À auditer par hook |
| `GRIPCLAW` | 2 | À auditer par hook |
| `GRISEOUSORB` | 2 | À auditer par hook |
| `GROUNDGEM` | 2 | À auditer par hook |
| `HABANBERRY` | 2 | À auditer par hook |
| `HARDSTONE` | 2 | Famille auditée — porté |
| `HEATROCK` | 2 | À auditer par hook |
| `IAPAPABERRY` | 1 | À auditer par hook |
| `ICEGEM` | 2 | À auditer par hook |
| `ICICLEPLATE` | 3 | Plaques — porté |
| `ICYROCK` | 2 | À auditer par hook |
| `INSECTPLATE` | 3 | Plaques — porté |
| `IRONBALL` | 6 | À auditer par hook |
| `IRONPLATE` | 3 | Plaques — porté |
| `JABOCABERRY` | 1 | À auditer par hook |
| `KASIBBERRY` | 2 | À auditer par hook |
| `KEBIABERRY` | 2 | À auditer par hook |
| `KEEBERRY` | 1 | À auditer par hook |
| `KINGSROCK` | 3 | À auditer par hook |
| `LAGGINGTAIL` | 3 | Famille auditée — porté |
| `LANSATBERRY` | 1 | À auditer par hook |
| `LAXINCENSE` | 2 | À auditer par hook |
| `LEFTOVERS` | 1 | Soin et drain — porté |
| `LEPPABERRY` | 1 | Famille auditée — porté |
| `LIECHIBERRY` | 1 | À auditer par hook |
| `LIFEORB` | 2 | Réactions et résidus — porté |
| `LIGHTBALL` | 5 | À auditer par hook |
| `LIGHTCLAY` | 4 | À auditer par hook |
| `LOADEDDICE` | 3 | À auditer par hook |
| `LUCKYPUNCH` | 2 | À auditer par hook |
| `LUMBERRY` | 1 | Famille auditée — porté |
| `LUMINOUSMOSS` | 1 | À auditer par hook |
| `LUSTROUSORB` | 2 | À auditer par hook |
| `MACHOBRACE` | 1 | À auditer par hook |
| `MAGNET` | 2 | Famille auditée — porté |
| `MAGOBERRY` | 1 | À auditer par hook |
| `MARANGABERRY` | 1 | À auditer par hook |
| `MASCARACRUEL` | 2 | Lot ciblé — porté |
| `MEADOWPLATE` | 3 | Plaques — porté |
| `MENTALHERB` | 2 | À auditer par hook |
| `METALCOAT` | 2 | Famille auditée — porté |
| `METALPOWDER` | 2 | À auditer par hook |
| `METRONOME` | 2 | À auditer par hook |
| `MICLEBERRY` | 1 | À auditer par hook |
| `MINDPLATE` | 3 | Plaques — porté |
| `MIRACLESEED` | 2 | Famille auditée — porté |
| `MUSCLEBAND` | 2 | À auditer par hook |
| `MYSTICWATER` | 2 | Famille auditée — porté |
| `NEVERMELTICE` | 2 | Famille auditée — porté |
| `NORMALGEM` | 2 | À auditer par hook |
| `NUDILLOPUAS` | 1 | À auditer par hook |
| `OCCABERRY` | 2 | À auditer par hook |
| `ODDINCENSE` | 2 | À auditer par hook |
| `ORANBERRY` | 1 | Famille auditée — porté |
| `PASSHOBERRY` | 2 | À auditer par hook |
| `PAYAPABERRY` | 2 | À auditer par hook |
| `PECHABERRY` | 1 | Famille auditée — porté |
| `PERSIMBERRY` | 1 | À auditer par hook |
| `PETAYABERRY` | 1 | À auditer par hook |
| `PIXIEPLATE` | 2 | Plaques — porté |
| `POISONBARB` | 3 | Famille auditée — porté |
| `POISONGEM` | 2 | À auditer par hook |
| `POWERANKLET` | 1 | À auditer par hook |
| `POWERBAND` | 1 | À auditer par hook |
| `POWERBELT` | 1 | À auditer par hook |
| `POWERBRACER` | 1 | À auditer par hook |
| `POWERHERB` | 16 | Herbe Pouvoir — porté |
| `POWERLENS` | 1 | À auditer par hook |
| `POWERWEIGHT` | 1 | À auditer par hook |
| `PSYCHICGEM` | 2 | À auditer par hook |
| `PUNCHINGGLOVE` | 5 | À auditer par hook |
| `PUNZASFERA` | 3 | Lot ciblé — porté |
| `QUICKCLAW` | 1 | Famille auditée — porté |
| `QUICKPOWDER` | 1 | À auditer par hook |
| `RAIZANCESTRAL` | 3 | Soin et drain — porté |
| `RAWSTBERRY` | 1 | Famille auditée — porté |
| `RAZORCLAW` | 2 | À auditer par hook |
| `RAZORFANG` | 3 | À auditer par hook |
| `REDCARD` | 1 | Lot ciblé — porté |
| `RINDOBERRY` | 2 | À auditer par hook |
| `RINGTARGET` | 14 | Cible Anneau — porté |
| `ROCKGEM` | 2 | À auditer par hook |
| `ROCKINCENSE` | 2 | À auditer par hook |
| `ROCKYHELMET` | 1 | Réactions et résidus — porté |
| `ROSEINCENSE` | 2 | À auditer par hook |
| `ROSELIBERRY` | 1 | Lot ciblé — porté |
| `ROWAPBERRY` | 1 | À auditer par hook |
| `SAFETYGOGGLES` | 4 | À auditer par hook |
| `SALACBERRY` | 1 | À auditer par hook |
| `SCOPELENS` | 2 | À auditer par hook |
| `SEAINCENSE` | 2 | À auditer par hook |
| `SHARPBEAK` | 2 | Famille auditée — porté |
| `SHEDSHELL` | 1 | À auditer par hook |
| `SHELLBELL` | 1 | Grelot Coque — porté |
| `SHOCKDRIVE` | 1 | À auditer par hook |
| `SHUCABERRY` | 2 | À auditer par hook |
| `SILKSCARF` | 2 | Famille auditée — porté |
| `SILVERPOWDER` | 2 | Famille auditée — porté |
| `SITRUSBERRY` | 1 | Famille auditée — porté |
| `SKYPLATE` | 3 | Plaques — porté |
| `SMOKEBALL` | 2 | Lot ciblé — porté |
| `SMOOTHROCK` | 2 | À auditer par hook |
| `SNOWBALL` | 1 | À auditer par hook |
| `SOFTSAND` | 2 | Famille auditée — porté |
| `SOULDEW` | 4 | À auditer par hook |
| `SPELLTAG` | 2 | Famille auditée — porté |
| `SPLASHPLATE` | 3 | Plaques — porté |
| `SPOOKYPLATE` | 3 | Plaques — porté |
| `STARFBERRY` | 1 | À auditer par hook |
| `STEELGEM` | 2 | À auditer par hook |
| `STICK` | 2 | À auditer par hook |
| `STICKYBARB` | 4 | Réactions et résidus — porté |
| `STONEPLATE` | 3 | Plaques — porté |
| `SUPEREVIOLITE` | 4 | À auditer par hook |
| `TABLAESQUI` | 2 | À auditer par hook |
| `TABLANEUTRA` | 2 | Plaques — porté |
| `TANGABERRY` | 2 | À auditer par hook |
| `TOXICORB` | 4 | À auditer par hook |
| `TOXICPLATE` | 3 | Plaques — porté |
| `TWISTEDSPOON` | 2 | Famille auditée — porté |
| `Tela` | 2 | Famille auditée — porté |
| `WACANBERRY` | 2 | À auditer par hook |
| `WATERGEM` | 2 | À auditer par hook |
| `WAVEINCENSE` | 2 | À auditer par hook |
| `WEAKNESSPOLICY` | 1 | À auditer par hook |
| `WHITEHERB` | 2 | À auditer par hook |
| `WIDELENS` | 2 | À auditer par hook |
| `WIKIBERRY` | 1 | À auditer par hook |
| `WISEGLASSES` | 2 | À auditer par hook |
| `YACHEBERRY` | 2 | À auditer par hook |
| `ZAPPLATE` | 3 | Plaques — porté |
| `ZOOMLENS` | 1 | À auditer par hook |
