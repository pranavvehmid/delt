export type CampusVenue = { name: string; url: string };

// VIT's official induction schedule and campus directory use these venue names.
const VELLORE_VENUES = [
  { name: "Silver Jubilee Tower", pattern: /\b(?:silver jubilee tower|SJT[ -]*\d{3,4})\b/i },
  { name: "Technology Tower", pattern: /\b(?:technology tower|TT[ -]*(?:gallery|\d{3,4})|VOC gallery|Shakespeare gallery)\b/i },
  { name: "Anna Auditorium", pattern: /\bAnna Auditorium\b/i },
  { name: "Pearl Research Park", pattern: /\b(?:pearl research park|PRP[ -]*\d{3,4})\b/i },
  { name: "Periyar EVR Central Library", pattern: /\bPeriyar\s+E\.?\s*V\.?\s*R\.?\s+Central Library\b/i },
];

export function campusVenues(email: string, messageText: string): CampusVenue[] {
  if (!/@(?:vitstudent\.ac\.in|vit\.ac\.in)$/i.test(email)) return [];
  const text = messageText.replace(/https?:\/\/\S+/gi, " ");
  if (/\b(?:VIT[ -]+(?:Chennai|Bhopal|AP|Amaravati)|(?:Chennai|Bhopal|Amaravati) campus)\b/i.test(text)) return [];
  return VELLORE_VENUES
    .map((venue) => ({ name: venue.name, at: text.search(venue.pattern) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(({ name }) => ({
      name,
      url: "https://www.google.com/maps/search/?" + new URLSearchParams({ api: "1", query: `${name}, VIT Vellore` }),
    }));
}
