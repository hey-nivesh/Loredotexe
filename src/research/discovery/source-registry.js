/**
 * Configurable Research Source Registry for RSS/Atom feeds and trend providers.
 */

export const DEFAULT_RESEARCH_SOURCES = Object.freeze([
  // Technology & AI
  {
    id: 'ars_technica_tech',
    name: 'Ars Technica',
    category: 'technology',
    feedUrl: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    siteUrl: 'https://arstechnica.com',
    sourceType: 'rss',
    reliabilityWeight: 0.9,
    description: 'In-depth technology and science reporting with strong editorial standards.'
  },
  {
    id: 'mit_tech_review',
    name: 'MIT Technology Review',
    category: 'technology',
    feedUrl: 'https://www.technologyreview.com/feed/',
    siteUrl: 'https://www.technologyreview.com',
    sourceType: 'rss',
    reliabilityWeight: 0.95,
    description: 'Authoritative emerging technology analysis and AI research.'
  },
  {
    id: 'hacker_news_rss',
    name: 'Hacker News Frontpage',
    category: 'technology',
    feedUrl: 'https://news.ycombinator.com/rss',
    siteUrl: 'https://news.ycombinator.com',
    sourceType: 'rss',
    reliabilityWeight: 0.75,
    description: 'Community-curated tech discussions, product launches, and breakthroughs.'
  },

  // Science & Space
  {
    id: 'phys_org_science',
    name: 'Phys.org',
    category: 'science',
    feedUrl: 'https://phys.org/rss-feed/',
    siteUrl: 'https://phys.org',
    sourceType: 'rss',
    reliabilityWeight: 0.9,
    description: 'Peer-reviewed science breakthroughs, physics, and astrophysics.'
  },
  {
    id: 'sciencedaily_latest',
    name: 'ScienceDaily',
    category: 'science',
    feedUrl: 'https://www.sciencedaily.com/rss/all.xml',
    siteUrl: 'https://www.sciencedaily.com',
    sourceType: 'rss',
    reliabilityWeight: 0.85,
    description: 'Research news and academic press releases from top research universities.'
  },

  // Gaming & Lore
  {
    id: 'ign_news',
    name: 'IGN News',
    category: 'gaming',
    feedUrl: 'https://feeds.feedburner.com/ign/all',
    siteUrl: 'https://www.ign.com',
    sourceType: 'rss',
    reliabilityWeight: 0.8,
    description: 'Gaming culture, franchise announcements, and entertainment lore.'
  },
  {
    id: 'pcgamer_news',
    name: 'PC Gamer',
    category: 'gaming',
    feedUrl: 'https://www.pcgamer.com/rss/',
    siteUrl: 'https://www.pcgamer.com',
    sourceType: 'rss',
    reliabilityWeight: 0.8,
    description: 'PC gaming deep dives, development updates, and franchise lore.'
  },

  // Culture & Current Affairs
  {
    id: 'bbc_technology',
    name: 'BBC News Technology',
    category: 'culture',
    feedUrl: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    siteUrl: 'https://www.bbc.com/news/technology',
    sourceType: 'rss',
    reliabilityWeight: 0.95,
    description: 'Global public broadcasting coverage of tech trends and societal impact.'
  }
]);

export class SourceRegistry {
  /**
   * @param {Array<object>} [customSources]
   */
  constructor(customSources = null) {
    this.sources = new Map();
    const list = customSources || DEFAULT_RESEARCH_SOURCES;
    for (const src of list) {
      this.registerSource(src);
    }
  }

  /**
   * Registers or updates a source.
   * @param {object} source
   */
  registerSource(source) {
    if (!source || !source.id || !source.feedUrl) {
      throw new Error("Source must contain 'id' and 'feedUrl'.");
    }
    this.sources.set(source.id, {
      ...source,
      category: (source.category || 'general').toLowerCase()
    });
  }

  /**
   * Returns all registered sources.
   * @returns {Array<object>}
   */
  getAllSources() {
    return Array.from(this.sources.values());
  }

  /**
   * Returns sources filtered by category.
   * @param {string} category
   * @returns {Array<object>}
   */
  getSourcesByCategory(category) {
    if (!category || category === 'all') {
      return this.getAllSources();
    }
    const target = category.toLowerCase();
    return this.getAllSources().filter((s) => s.category === target);
  }

  /**
   * Finds a source by ID.
   * @param {string} id
   * @returns {object|null}
   */
  getSourceById(id) {
    return this.sources.get(id) || null;
  }
}

export const sourceRegistry = new SourceRegistry();
