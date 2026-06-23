import { fetchAgendaLxEvents, fetchTicketmasterEvents } from '../palco-api-client.js';

const eventCache = new Map();

function normalizeText(value = "") {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, amount) {
    const base = new Date(`${dateStr}T00:00:00`);
    base.setDate(base.getDate() + amount);
    return base.toISOString().slice(0, 10);
}

function uniqBy(items, keyFn) {
    const seen = new Set();
    return items.filter(item => {
        const key = keyFn(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function inferAgendaCategory(raw) {
    const bag = normalizeText([
        raw.subtitle,
        raw.subject,
        ...(Object.values(raw.categories_name_list || {}).map(item => item?.name || "")),
        ...(raw.tags_name_list || []).map(item => item?.name || "")
    ].join(" "));

    if (/(teatro|opera|drama|performance)/.test(bag)) return "Teatro";
    if (/(danca|ballet|bailado|coreografia)/.test(bag)) return "Danca";
    if (/(musica|concerto|jazz|dj|festival|sonoro)/.test(bag)) return "Musica";
    if (/(arte|galeria|exposicao|museu|instalacao|fotografia)/.test(bag)) return "Arte";
    return "Outros";
}

function inferTicketmasterCategory(raw) {
    const classification = raw?.classifications?.[0] || {};
    const bag = normalizeText([
        raw?.name,
        classification.segment?.name,
        classification.genre?.name,
        classification.subGenre?.name,
        classification.type?.name,
        classification.subType?.name
    ].join(" "));

    if (/(theatre|theater|opera|drama|performance|play)/.test(bag)) return "Teatro";
    if (/(dance|ballet)/.test(bag)) return "Danca";
    if (/(music|concert|festival|jazz|live)/.test(bag)) return "Musica";
    if (/(art|gallery|exhibition|museum)/.test(bag)) return "Arte";
    return "Outros";
}

function getFirstOccurrence(raw) {
    const occurrences = Array.isArray(raw.occurences) ? raw.occurences.filter(Boolean).sort() : [];
    return occurrences[0] || "";
}

function getBestTicketmasterImage(raw) {
    const images = Array.isArray(raw?.images) ? raw.images : [];
    return images.find(img => img.ratio === "16_9" && img.url)
        || images.find(img => img.ratio === "4_3" && img.url)
        || images.find(img => img.url)
        || null;
}

function buildAgendaEvent(raw) {
    const releaseDate = getFirstOccurrence(raw);
    const category = inferAgendaCategory(raw);
    const venue = Object.values(raw.venue || {})[0]?.name || "";
    const description = Array.isArray(raw.description) ? raw.description[0] : "";
    const sourceId = `agenda-${raw.id}`;
    const mapped = {
        source: "agenda-lx",
        sourceId,
        kind: "event",
        categoryTag: "eventos",
        title: raw.title?.rendered || "Evento",
        subtitle: category,
        imageUrl: raw.featured_media_large || "",
        releaseDate,
        year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
        month: releaseDate ? Number(releaseDate.slice(5, 7)) : null,
        description: description || raw.string_dates || "Evento encontrado via Agenda LX.",
        genres: [category],
        people: [venue].filter(Boolean),
        trailerUrl: "",
        previewUrl: raw.link || "",
        externalIds: { agendaLx: String(raw.id || "") },
        badges: ["AgendaLX", category],
        local: venue,
        cidade: "Lisboa",
        dataInicio: releaseDate,
        dataFim: Array.isArray(raw.occurences) && raw.occurences.length ? raw.occurences[raw.occurences.length - 1] : releaseDate,
        related: venue ? [{ title: venue, subtitle: "Espaco", imageUrl: "", year: null }] : []
    };
    eventCache.set(sourceId, mapped);
    return mapped;
}

function buildTicketmasterEvent(raw) {
    const date = raw?.dates?.start?.localDate || "";
    const time = raw?.dates?.start?.localTime || "";
    const releaseDate = date ? `${date}${time ? `T${time}` : ""}` : "";
    const venue = raw?._embedded?.venues?.[0] || null;
    const category = inferTicketmasterCategory(raw);
    const image = getBestTicketmasterImage(raw);
    const sourceId = `ticketmaster-${raw.id}`;
    const mapped = {
        source: "ticketmaster",
        sourceId,
        kind: "event",
        categoryTag: "eventos",
        title: raw.name || "Evento",
        subtitle: category,
        imageUrl: image?.url || "",
        releaseDate,
        year: date ? Number(date.slice(0, 4)) : null,
        month: date ? Number(date.slice(5, 7)) : null,
        description: raw.info || raw?.classifications?.[0]?.segment?.name || "Evento encontrado via Ticketmaster.",
        genres: [
            raw?.classifications?.[0]?.segment?.name,
            raw?.classifications?.[0]?.genre?.name,
            raw?.classifications?.[0]?.subGenre?.name
        ].filter(Boolean),
        people: (raw?._embedded?.attractions || []).map(item => item.name).filter(Boolean),
        trailerUrl: "",
        previewUrl: raw.url || "",
        externalIds: { ticketmaster: String(raw.id || "") },
        badges: ["Ticketmaster", category],
        local: venue?.name || "",
        cidade: venue?.city?.name || venue?.state?.name || "",
        dataInicio: releaseDate,
        dataFim: releaseDate,
        related: venue ? [{ title: venue.name, subtitle: venue.city?.name || "Espaco", imageUrl: "", year: null }] : []
    };
    eventCache.set(sourceId, mapped);
    return mapped;
}

async function attempt(loader, fallback = []) {
    try {
        const result = await loader();
        return Array.isArray(result) ? result : fallback;
    } catch (error) {
        console.warn("Palco events source fallback:", error);
        return fallback;
    }
}

async function fetchAgendaEvents() {
    const data = await fetchAgendaLxEvents(80);
    return (Array.isArray(data) ? data : []).map(buildAgendaEvent);
}

async function fetchTicketmasterEventsList() {
    const today = todayIso();
    const data = await fetchTicketmasterEvents({
        countryCode: "PT",
        locale: "pt-PT",
        page: 0,
        size: 60,
        sort: "date,asc",
        startDateTime: `${today}T00:00:00Z`
    });
    return (data?._embedded?.events || []).map(buildTicketmasterEvent);
}

function matchesSearch(item, searchTerm) {
    const bag = normalizeText([
        item.title,
        item.subtitle,
        item.description,
        ...(item.genres || []),
        ...(item.people || []),
        item.local,
        item.cidade
    ].join(" "));
    return bag.includes(normalizeText(searchTerm));
}

function filterByCategory(items, mode) {
    if (mode === "teatro") return items.filter(item => item.subtitle === "Teatro");
    if (mode === "arte") return items.filter(item => item.subtitle === "Arte");
    if (mode === "musica") return items.filter(item => item.subtitle === "Musica");
    if (mode === "danca") return items.filter(item => item.subtitle === "Danca");
    if (mode === "outros") return items.filter(item => item.subtitle === "Outros");
    return items;
}

async function getLiveEvents() {
    const [agendaEvents, ticketmasterEvents] = await Promise.all([
        attempt(() => fetchAgendaEvents()),
        attempt(() => fetchTicketmasterEventsList())
    ]);

    return uniqBy([...agendaEvents, ...ticketmasterEvents], item => item.sourceId);
}

export async function listEventItems(mode = "novidades", options = {}) {
    const allEvents = await getLiveEvents();
    const today = todayIso();
    const soonBoundary = addDays(today, 21);
    const futureEvents = allEvents
        .filter(item => !item.releaseDate || item.releaseDate >= today)
        .sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));

    if (mode === "pesquisa") {
        const term = options.searchTerm || "";
        return term.trim().length < 2 ? [] : futureEvents.filter(item => matchesSearch(item, term)).slice(0, 24);
    }
    if (mode === "novidades") return futureEvents.slice(0, 18);
    if (mode === "brevemente") return futureEvents.filter(item => item.releaseDate > soonBoundary).slice(0, 18);
    return filterByCategory(futureEvents, mode).slice(0, 18);
}

export async function getEventDetails(sourceId, fallbackItem = null) {
    return eventCache.get(sourceId) || fallbackItem || null;
}
