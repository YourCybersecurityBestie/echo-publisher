import { XMLBuilder, XMLParser } from 'fast-xml-parser';

export interface FeedItem {
  guid: string;
  title: string;
  description: string;
  pubDate: string;
  enclosureUrl: string;
  enclosureLength: number;
  durationSeconds: number;
}

interface RssChannelItem {
  title: string;
  description: string;
  pubDate: string;
  guid: { '#text': string; '@_isPermaLink': string };
  enclosure: { '@_url': string; '@_length': string; '@_type': string };
  'itunes:duration': string;
}

interface RssDoc {
  '?xml': { '@_version': string; '@_encoding': string };
  rss: {
    '@_version': string;
    '@_xmlns:itunes': string;
    channel: {
      title: string;
      description: string;
      link: string;
      language: string;
      'itunes:author': string;
      'itunes:image': { '@_href': string };
      item: RssChannelItem[];
    };
  };
}

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

const BUILDER = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true
});

function emptyFeed(opts: {
  title: string;
  description: string;
  link: string;
  coverUrl: string;
}): RssDoc {
  return {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    rss: {
      '@_version': '2.0',
      '@_xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
      channel: {
        title: opts.title,
        description: opts.description,
        link: opts.link,
        language: 'en-us',
        'itunes:author': 'Echo',
        'itunes:image': { '@_href': opts.coverUrl },
        item: []
      }
    }
  };
}

export function parseFeed(xml: string): RssDoc {
  return PARSER.parse(xml) as RssDoc;
}

export function buildFeed(doc: RssDoc): string {
  return BUILDER.build(doc);
}

export function appendItem(
  doc: RssDoc | null,
  item: FeedItem,
  defaults: { title: string; description: string; link: string; coverUrl: string }
): RssDoc {
  const feed = doc ?? emptyFeed(defaults);
  const channel = feed.rss.channel;
  const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  const newItem: RssChannelItem = {
    title: item.title,
    description: item.description,
    pubDate: item.pubDate,
    guid: { '#text': item.guid, '@_isPermaLink': 'false' },
    enclosure: {
      '@_url': item.enclosureUrl,
      '@_length': String(item.enclosureLength),
      '@_type': 'audio/mpeg'
    },
    'itunes:duration': formatDuration(item.durationSeconds)
  };
  channel.item = [newItem, ...items];
  return feed;
}

export function listItems(doc: RssDoc | null, limit: number): RssChannelItem[] {
  if (!doc) return [];
  const items = doc.rss.channel.item;
  if (!items) return [];
  return Array.isArray(items) ? items.slice(0, limit) : [items];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
