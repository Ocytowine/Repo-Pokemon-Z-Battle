# Compteurs du portage des objets

État du 2026-10-26. Les deux périmètres se recoupent : une baie peut être
utilisée depuis le sac et tenue par un Pokémon. **Ne pas additionner les
numérateurs ou les dénominateurs.**

| Périmètre source | Portés et vérifiés | Pas encore traités par l'audit |
| --- | ---: | ---: |
| Utilisables depuis le sac en combat (`items.json`, `battleUse > 0`) | **73 / 114** | **41** |
| Tenus avec effet de combat (`hasWorkingItem` dans le Ruby) | **75 / 203** | **128** |

Le premier compteur réunit 33 objets de combat, 31 médicaments et 9 baies
dont les effets sont confirmés par `item-coverage-report.json`. Parmi les
41 autres : 28 Poké Balls et 2 flûtes possèdent déjà du code, la Baie Kika
(`PERSIMBERRY`) a un handler de sac source à raccorder, et 10 entrées PBS
signalent un usage en combat sans handler dans le jeu source. « Pas encore
traité » ne veut donc pas dire « sans code » ou « à porter ».

Le second compteur réunit les 43 objets vérifiés dans
`AUDIT_OBJETS_TENUS.md` et 32 objets tenus déjà vérifiés dans les cinq
familles de `item-coverage-report.json`. Ces 32 noms sont maintenant
reportés dans l'inventaire tenu. Les 128 autres attendent une comparaison
de leurs effets aux hooks Ruby ; certains fonctionnent déjà.

Le catalogue PBS complet contient 906 entrées. Le précédent chiffre
138/906 était seulement une borne basse intercatégories ; il ne décrivait
pas la progression de ces deux périmètres de combat.
