

Description :
lorsque le joueur cours, il est comme en lévitation, il est un peu surélevé du sol en comparaison du mode "marche" (soit l'animation ce place trop haute, soit l'ombre du personnage est trop basse, ou les deux)

de plus, quand le joueur cours en se déplaçant, et que le joueur arrête net son déplacement sans passer par le mode "marche" le personnage reste dans la position "courir" (le sprite ne revient au mode normal)
(il reste en lévitation et penché comme michel jackson)

la vitesse de marche est trop rapide et le sprint ne change pas la vitesse.
le bug est purement visuel pour le moment

État du 27/10/2026 : correctif dans le moteur. La pose de course cesse à l'arrêt,
les pieds de chaque image de course sont alignés sur la marche, et les durées
sont désormais de 200 ms/case à pied et 105 ms/case en sprint. À contrôler
visuellement sur téléphone en solo puis avec hôte/invité Coop ; l'APK n'a pas
encore été réinstallé depuis ce correctif.
