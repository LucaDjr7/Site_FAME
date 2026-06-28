// Predefined domain ("kicker") options for the subject vitrine.
// The domain is almost always "Research · <field>"; this curated list keeps it
// consistent. Localized per UI locale; the selected string is stored as-is in
// `subjects.kicker`. Edit this list to add/adjust domains.

export const DOMAIN_OPTIONS: Record<'en' | 'fr', string[]> = {
  en: [
    'Research · AI',
    'Research · Finance',
    'Research · AI & Finance',
    'Research · Computational Finance',
    'Research · Machine Learning',
    'Research · Risk Management',
    'Research · Econometrics',
    'Research · Data Science',
  ],
  fr: [
    'Recherche · IA',
    'Recherche · Finance',
    'Recherche · IA & Finance',
    'Recherche · Finance computationnelle',
    'Recherche · Machine Learning',
    'Recherche · Gestion des risques',
    'Recherche · Économétrie',
    'Recherche · Science des données',
  ],
}
