import { useState, useRef, useCallback, useEffect } from "react";

// ============================================================
// CONFIGURATION — your keys go here
// ============================================================
const CONFIG = {
  NOTION_TOKEN: process.env.REACT_APP_NOTION_TOKEN,
  NOTION_PROPERTIES_DB_ID: process.env.REACT_APP_NOTION_PROPERTIES_DB_ID,
  CLOUDINARY_CLOUD_NAME: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET: process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET,
  GOOGLE_MAPS_API_KEY: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
};

// ============================================================
// NOTION API
// ============================================================
const notion = {
  async query(databaseId) {
    const res = await fetch(`/api/notion?endpoint=databases/${databaseId}/query`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    return res.json();
  },
  async getPage(pageId) {
    const res = await fetch(`/api/notion?endpoint=pages/${pageId}`);
    return res.json();
  },
  async getBlocks(blockId) {
    const res = await fetch(`/api/notion?endpoint=blocks/${blockId}/children?page_size=100`);
    return res.json();
  },
  async updatePage(pageId, properties) {
    const res = await fetch(`/api/notion?endpoint=pages/${pageId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    return res.json();
  },
  async appendBlocks(blockId, children) {
    const res = await fetch(`/api/notion?endpoint=blocks/${blockId}/children`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ children }),
    });
    return res.json();
  },
  async updateBlock(blockId, content) {
    const res = await fetch(`/api/notion?endpoint=blocks/${blockId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    return res.json();
  },
  async createPage(databaseId, properties, children) {
    const res = await fetch(`/api/notion?endpoint=pages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent: { database_id: databaseId }, properties, children: children || [] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Notion rejected the request");
    return data;
  },
  async createDatabaseRow(databaseId, properties) {
    const res = await fetch(`/api/notion?endpoint=pages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to create row");
    return data;
  },
  async createDatabase(pageId, title, properties) {
    const res = await fetch(`/api/notion?endpoint=databases`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent: { type: "page_id", page_id: pageId },
        is_inline: true,
        title: [{ type: "text", text: { content: title } }],
        properties,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to create database");
    return data;
  },
  async archivePage(pageId) {
    const res = await fetch(`/api/notion?endpoint=pages/${pageId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    return res.json();
  },
};

// ============================================================
// CLOUDINARY
// ============================================================
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CONFIG.CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData }
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
}

// ============================================================
// NOTION TEMPLATE BUILDER
// Headings and field names match the Notion template exactly
// ============================================================
function buildPropertyTemplate() {
  const makeTable = (fields) => ({
    object: "block", type: "table",
    table: {
      table_width: 2, has_column_header: true, has_row_header: false,
      children: [
        { object: "block", type: "table_row", table_row: { cells: [[{ type: "text", text: { content: "Item" } }], [{ type: "text", text: { content: "Details" } }]] } },
        ...fields.map(f => ({ object: "block", type: "table_row", table_row: { cells: [[{ type: "text", text: { content: f } }], []] } }))
      ]
    }
  });
  const makeHeading = (text) => ({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: text } }] } });
  const makeParagraph = (text = "") => ({ object: "block", type: "paragraph", paragraph: { rich_text: text ? [{ type: "text", text: { content: text } }] : [] } });
  const makeDbPlaceholder = (name) => makeParagraph(`↓ Add inline database here for: ${name}`);

  return [
    // Backend only
    makeHeading("📌 Property Info"),
    makeTable(["Cleaning fee", "Pay to Cleaner", "Airbnb Link", "VRBO Link", "BDC Link", "City License Number", "Provincial License Number"]),
    makeParagraph("City License Pic"),
    makeParagraph("Provincial License Pic"),
    makeParagraph(),

    makeHeading("🪪 Owner Info"),
    makeTable(["Legal Name For Direct Deposit", "Birthday", "Phone Number", "Email", "Direct Deposit Acct #", "VRBO Login", "BDC Login"]),
    makeParagraph(),

    // Field app sections — headings match template exactly
    makeHeading("📶 Wifi"),
    makeTable(["WiFi Name", "WiFi Password", "Router Location", "Known Issues / Notes"]),
    makeParagraph(),

    makeHeading("🔑 Entry, Check In, & Walk-Through Video"),
    makeTable(["Lock Type", "Number of Steps to Door", "Lock Brand & Model", "Lock Battery Replacement Details", "Codes Set Up", "Buzzer", "Common Guest Confusions"]),
    makeParagraph(),

    makeHeading("🚗 Parking"),
    makeTable(["Parking Type", "Assigned Stall/Spot #", "Garage Instructions", "Parking Limits & Warning"]),
    makeParagraph(),

    makeHeading("🌡 Heating & A/C & Thermostat"),
    makeTable(["Heating Type", "Cooling Type", "Thermostat Locations", "Noise / Delay Warnings"]),
    makeParagraph(),

    makeHeading("🗑 Garbage/Recycling/Compost"),
    makeTable(["Location", "Pick Up Days", "Notes for guests"]),
    makeParagraph(),

    makeHeading("🧺 Laundry"),
    makeTable(["Laundry Type", "Location", "Iron/board", "Quiet Hours", "Special Instructions"]),
    makeParagraph(),

    makeHeading("🚨 Safety & House Rules"),
    makeTable(["Fire Extinguisher Location", "First Aid Kit", "Flash Light", "Quiet Hours", "Pet/Other Policies", "Exterior Security Camera", "Sound/Other Monitors"]),
    makeParagraph(),

    makeHeading("🧹 Cleaner Closet & Supplies"),
    makeTable(["Cleaner Closet Location", "Access Code/Key Location", "Extra Linen Location (if not in main cleaner closet)", "Supplies Location (if not in main cleaner closet)", "Notes For Cleaners"]),
    makeParagraph(),

    makeHeading("🏢 Building Info (if applicable)"),
    makeTable(["Elevator Notes", "Concierge Hours", "Amenities Access", "Strata Restrictions", "Building Notes"]),
    makeParagraph(),

    // Backend only
    makeHeading("⚠️ Known Issues & Complaints"),
    makeTable(["Common Questions", "Past Complaints", "Noise Sources", "Others"]),
    makeParagraph(),
  ];
}

// ============================================================
// HEADING NORMALIZER
// Strips leading emoji + whitespace before matching.
// "🔑 Entry, Check In, & Walk-Through Video" → "Entry, Check In, & Walk-Through Video"
// This means notionHeading values in CATEGORIES never need emojis,
// and matching is immune to emoji variant changes in Notion.
// ============================================================
function normalizeHeading(text) {
  return text.replace(/^[\p{Emoji}\s]+/u, "").trim();
}

// ============================================================
// NOTION PAGE PARSER
// ============================================================
async function parsePropertyPage(pageId) {
  const blocks = await notion.getBlocks(pageId);
  const result = {};
  let currentHeading = null;
  const subFetches = [];

  for (const block of blocks.results || []) {
    if (["heading_1", "heading_2", "heading_3"].includes(block.type)) {
      const text = block[block.type]?.rich_text?.[0]?.plain_text || "";
      currentHeading = normalizeHeading(text);
      result[currentHeading] = { blockId: block.id, tableBlockId: null, rows: [], type: null, mediaBlocks: [] };
    }
    if (currentHeading && block.type === "table") {
      result[currentHeading].tableBlockId = block.id;
      result[currentHeading].type = "simple_table";
      const heading = currentHeading;
      subFetches.push(
        notion.getBlocks(block.id).then(tableChildren => {
          for (const row of tableChildren.results || []) {
            if (row.type === "table_row") {
              const cells = row.table_row?.cells || [];
              result[heading].rows.push({
                blockId: row.id,
                col0: cells[0]?.[0]?.plain_text || "",
                col1: cells[1]?.[0]?.plain_text || "",
              });
            }
          }
        })
      );
    }
    if (currentHeading && block.type === "child_database") {
      result[currentHeading].tableBlockId = block.id;
      result[currentHeading].type = "database";
      const heading = currentHeading;
      subFetches.push(
        notion.query(block.id).then(dbRows => {
          result[heading].rows = (dbRows.results || []).map(row => ({
            pageId: row.id,
            item: row.properties?.Item?.title?.[0]?.plain_text || "",
            details: row.properties?.Details?.rich_text?.[0]?.plain_text || "",
            photoUrl: row.properties?.Photo?.files?.[0]?.external?.url || row.properties?.Photo?.files?.[0]?.file?.url || null,
            videoUrl: row.properties?.Video?.files?.[0]?.external?.url || row.properties?.Video?.files?.[0]?.file?.url || null,
          }));
        })
      );
    }
    if (currentHeading && block.type === "image") {
      const url = block.image?.external?.url || block.image?.file?.url || null;
      if (url) result[currentHeading].mediaBlocks.push({ blockId: block.id, type: "image", url });
    }
    if (currentHeading && block.type === "video") {
      const url = block.video?.external?.url || block.video?.file?.url || null;
      if (url) result[currentHeading].mediaBlocks.push({ blockId: block.id, type: "video", url });
    }
  }
  await Promise.all(subFetches);
  return result;
}

// ============================================================
// SCHEMA
// notionHeading values match the Notion template headings exactly
// ============================================================
const FIELD_APP_HEADER_FIELDS = [
  { key: "Property Type", type: "dropdown", notion_property: "Property Type",
    options: ["Room", "Laneway", "Basement", "House", "Apartment", "Duplex", "Backyard Secondary Suite (ground level)"] },
  { key: "City", type: "dropdown", notion_property: "City",
    options: ["Delta", "Langley", "Surrey", "Richmond", "Vancouver", "West Van", "North Van", "Coquitlam"] },
  { key: "# Bath", type: "dropdown", notion_property: "# Bath",
    options: ["0","0.5","1","1.5","2","2.5","3","3.5","4","4.5","5","5.5","6","6.5","7","7.5","8","8.5","9","9.5","10"] },
  { key: "# Rooms", type: "dropdown", notion_property: "# Rooms",
    options: ["0","1","2","3","4","5","6","7","8","9","10"] },
  { key: "Max Occupancy", type: "number", notion_property: "Max Occupancy" },
  { key: "Privacy", type: "dropdown", notion_property: "Privacy",
    options: ["Owner lives upstairs", "Tenant lives upstairs", "Guest gets whole place"] },
  { key: "Commission", type: "number", notion_property: "Commission", percent: true },
  { key: "Lock Type", type: "dropdown", notion_property: "Lock Type",
    options: ["Hospitable", "Manual", "Eufy", "Fixed", "Keys left inside", "Lock box", "Sue Add"] },
  { key: "Cleaner", type: "dropdown", notion_property: "Cleaner",
    options: ["Anna", "Self-clean", "Owner", "Mariella", "Audrey"] },
  { key: "Supply", type: "dropdown", notion_property: "Supply",
    options: ["OpulentStays", "Owner"] },
  // Issues/Tickets and Special Note intentionally excluded — backend team only
];

// Category order matches the Notion template page order
// notionHeading is the exact heading text in Notion (including emoji, spacing, typos)
const CATEGORIES = [
  { id: "wifi", order: 1, type: 1, emoji: "📶", title: "WiFi",
    notionHeading: "Wifi",
    fields: [
      { key: "WiFi Name", type: "text" },
      { key: "WiFi Password", type: "text" },
      { key: "Router Location", type: "text" },
      { key: "Known Issues / Notes", type: "text" },
    ]},
  { id: "entry", order: 2, type: 1, emoji: "🔑", title: "Entry, Check In & Walk-Through Video",
    notionHeading: "Entry, Check In, & Walk-Through Video",
    fields: [
      { key: "Lock Type", type: "text" },
      { key: "Who changes the passcode?", type: "dropdown", options: ["Opulent Stays", "Owner", "Cleaners"] },
      { key: "Number of Steps to Door", type: "text" },
      { key: "Lock Brand & Model", type: "text" },
      { key: "Lock Battery Replacement Details", type: "text" },
      { key: "Codes Set Up", type: "text" },
      { key: "Buzzer", type: "text" },
      { key: "Common Guest Confusions", type: "text" },
    ]},
  { id: "parking", order: 3, type: 1, emoji: "🚗", title: "Parking",
    notionHeading: "Parking",
    fields: [
      { key: "Parking Type", type: "text" },
      { key: "Assigned Stall/Spot #", type: "text" },
      { key: "Garage Instructions", type: "text" },
      { key: "Parking Limits & Warning", type: "text" },
    ]},
  { id: "hvac", order: 4, type: 1, emoji: "🌡", title: "Heating & A/C & Thermostat",
    notionHeading: "Heating & A/C & Thermostat",
    fields: [
      { key: "Heating Type", type: "dropdown", options: ["Forced air", "Floor heating", "Baseboard", "Portable", "Fireplace"] },
      { key: "Cooling Type", type: "dropdown", options: ["Yes", "None"] },
      { key: "Thermostat Locations", type: "text" },
      { key: "Noise / Delay Warnings", type: "text" },
    ]},
  { id: "garbage", order: 5, type: 1, emoji: "🗑", title: "Garbage/Recycling/Compost",
    notionHeading: "Garbage/Recycling/Compost",
    fields: [
      { key: "Location", type: "text" },
      { key: "Pick Up Days", type: "text" },
      { key: "Notes for guests", type: "text" },
    ]},
  { id: "laundry", order: 6, type: 1, emoji: "🧺", title: "Laundry",
    notionHeading: "Laundry",
    fields: [
      { key: "Laundry Type", type: "dropdown", options: ["None", "In unit", "Shared"] },
      { key: "Location", type: "text" },
      { key: "Iron/board", type: "text" },
      { key: "Quiet Hours", type: "text" },
      { key: "Special Instructions", type: "text" },
    ]},
  { id: "safety", order: 7, type: 1, emoji: "🚨", title: "Safety & House Rules",
    notionHeading: "Safety & House Rules",
    fields: [
      { key: "Fire Extinguisher Location", type: "text" },
      { key: "First Aid Kit", type: "text" },
      { key: "Flash Light", type: "text" },
      { key: "Quiet Hours", type: "text" },
      { key: "Pet/Other Policies", type: "text" },
      { key: "Exterior Security Camera", type: "text" },
      { key: "Sound/Other Monitors", type: "text" },
    ]},
  { id: "cleaner", order: 8, type: 1, emoji: "🧹", title: "Cleaner Closet & Supplies",
    notionHeading: "Cleaner Closet & Supplies",
    fields: [
      { key: "Cleaner Closet Location", type: "text" },
      { key: "Access Code/Key Location", type: "text" },
      { key: "Extra Linen Location (if not in main cleaner closet)", type: "text" },
      { key: "Supplies Location (if not in main cleaner closet)", type: "text" },
      { key: "Notes For Cleaners", type: "text" },
    ]},
  { id: "building", order: 9, type: 1, emoji: "🏢", title: "Building Info (if applicable)",
    notionHeading: "Building Info (if applicable)",
    fields: [
      { key: "Elevator Notes", type: "text" },
      { key: "Concierge Hours", type: "text" },
      { key: "Amenities Access", type: "text" },
      { key: "Strata Restrictions", type: "text" },
      { key: "Building Notes", type: "text" },
    ]},
  { id: "bedroom", order: 10, type: 2, emoji: "🛏️", title: "Bedroom & Washroom",
    notionHeading: "Bedroom & Washroom", columns: ["Item", "Floor", "Bed Size", "Amenities", "Ensuite", "Shower Type"] },
  { id: "amenities", order: 11, type: 2, emoji: "✨", title: "Amenities",
    notionHeading: "Amenities", columns: ["Item"] },
  { id: "kitchen", order: 12, type: 2, emoji: "🍳", title: "Kitchen & Appliances",
    notionHeading: "Kitchen & Appliances", columns: ["Item"] },
  { id: "breaker", order: 13, type: 2, emoji: "🔌", title: "Breaker Panel, Gas, Water, Furnance",
    // NOTE: "Furnance" matches the typo in the actual Notion template
    notionHeading: "Breaker Panel, Gas, Water, Furnance", columns: ["Item"] },
];

// ============================================================
// NOTION DATABASE SCHEMAS FOR TYPE 2 CATEGORIES
// ============================================================
const TYPE2_DB_SCHEMAS = {
  bedroom: {
    "Item":       { "title": {} },
    "Floor":      { "select": {} },
    "Bed Size":   { "select": {} },
    "Amenities":  { "multi_select": {} },
    "Ensuite":    { "select": {} },
    "Shower Type":{ "select": {} },
  },
  amenities: { "Item": { "title": {} } },
  kitchen:   { "Item": { "title": {} } },
  breaker:   { "Item": { "title": {} }, "Details": { "rich_text": {} } },
};

// ============================================================
// KITCHEN COMMON ITEMS
// ============================================================
const KITCHEN_COMMON_ITEMS = [
  "Kettle", "Toaster", "Drip Coffee Machine", "Pods Coffee Machine",
  "Microwave", "Fridge", "Oven", "Steam Oven", "Secondary Fridge",
  "Secondary Oven", "Secondary Stove", "Electric Stove", "Gas Stove",
  "Dishwasher", "Water Filter",
];

// ============================================================
// BEDROOM / WASHROOM SERIALIZE & PARSE
// ============================================================
function serializeBedroomDetails(item) {
  const parts = [];
  if (item.bedSize) parts.push(`Size:${item.bedSize}`);
  if (item.floor) parts.push(`Floor:${item.floor}`);
  if (item.amenities?.length) parts.push(`Has:${item.amenities.join(",")}`);
  parts.push(`Ensuite:${item.ensuite || "No"}`);
  if (item.ensuite === "Yes" && item.showerType) parts.push(`Shower:${item.showerType}`);
  return parts.join("|");
}
function parseBedroomDetails(details) {
  const result = { bedSize: "", floor: "", amenities: [], ensuite: "No", showerType: "" };
  if (!details) return result;
  details.split("|").forEach(part => {
    const idx = part.indexOf(":");
    if (idx === -1) return;
    const key = part.slice(0, idx);
    const val = part.slice(idx + 1);
    if (key === "Size") result.bedSize = val;
    else if (key === "Floor") result.floor = val;
    else if (key === "Has") result.amenities = val ? val.split(",") : [];
    else if (key === "Ensuite") result.ensuite = val;
    else if (key === "Shower") result.showerType = val;
  });
  return result;
}
function serializeWashroomDetails(item) {
  const parts = [];
  if (item.showerType) parts.push(`Shower:${item.showerType}`);
  if (item.details) parts.push(`Note:${item.details}`);
  return parts.join("|");
}
function parseWashroomDetails(details) {
  const result = { showerType: "", details: "" };
  if (!details) return result;
  details.split("|").forEach(part => {
    const idx = part.indexOf(":");
    if (idx === -1) return;
    const key = part.slice(0, idx);
    const val = part.slice(idx + 1);
    if (key === "Shower") result.showerType = val;
    else if (key === "Note") result.details = val;
  });
  return result;
}

// ============================================================
// STYLES
// ============================================================
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f4ef;
    --surface: #ffffff;
    --surface2: #f0ece4;
    --border: #ddd8ce;
    --border2: #c8c2b6;
    --navy: #1B4886;
    --navy-dark: #143668;
    --navy-light: #e8eef7;
    --gold: #C4922A;
    --gold-light: #fdf3e3;
    --gold-dark: #a8791f;
    --green: #2D6A4F;
    --green-light: #e8f4ee;
    --text: #1a1a2e;
    --text2: #6b6560;
    --text3: #9e9890;
    --danger: #c0392b;
    --radius: 10px;
    --shadow: 0 1px 3px rgba(27,72,134,0.08), 0 1px 2px rgba(27,72,134,0.05);
    --shadow-md: 0 4px 12px rgba(27,72,134,0.1), 0 2px 4px rgba(27,72,134,0.06);
  }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; }
  .app { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; }

  .app-header { padding: 18px 24px 14px; background: var(--navy); position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 8px rgba(27,72,134,0.2); }
  .header-top { display: flex; align-items: center; justify-content: space-between; }
  .logo { font-family: 'Playfair Display', serif; font-size: 18px; color: #fff; }
  .logo span { color: #C4922A; }
  .subtitle { font-size: 10px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.12em; margin-top: 1px; }
  .btn-back-header { padding: 7px 12px; font-size: 12px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.15s; }
  .btn-back-header:hover { background: rgba(255,255,255,0.2); }
  .progress-bar { height: 3px; background: rgba(255,255,255,0.2); margin-top: 12px; border-radius: 2px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #C4922A, #e8b84b); transition: width 0.4s ease; }
  .progress-label { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 5px; }

  .screen { flex: 1; padding: 24px; animation: fadeUp 0.2s ease; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .screen-title { font-family: 'Playfair Display', serif; font-size: 26px; color: var(--navy); margin-bottom: 4px; }
  .screen-sub { font-size: 13px; color: var(--text2); margin-bottom: 20px; }

  .search-box { width: 100%; padding: 11px 16px; border-radius: var(--radius); background: var(--surface); border: 1.5px solid var(--border); color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px; margin-bottom: 16px; outline: none; transition: border-color 0.2s; box-shadow: var(--shadow); }
  .search-box:focus { border-color: var(--navy); }
  .search-box::placeholder { color: var(--text3); }

  .list-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .property-list { display: flex; flex-direction: column; gap: 8px; }
  .property-card { padding: 14px 18px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.15s; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow); }
  .property-card:hover { border-color: var(--navy); box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .p-name { font-weight: 600; font-size: 14px; color: var(--text); }
  .p-addr { font-size: 12px; color: var(--text2); margin-top: 2px; }
  .arrow { color: var(--navy); font-size: 20px; }

  .btn-new-property { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--gold); color: white; border: none; border-radius: var(--radius); font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; box-shadow: 0 2px 6px rgba(196,146,42,0.3); white-space: nowrap; }
  .btn-new-property:hover { background: var(--gold-dark); }

  .new-property-card { background: var(--navy-light); border: 1.5px solid var(--navy); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; animation: fadeUp 0.2s ease; }
  .new-property-title { font-family: 'Playfair Display', serif; font-size: 16px; color: var(--navy); margin-bottom: 14px; }
  .new-property-row { display: flex; gap: 8px; margin-top: 14px; }

  .category-overview { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .cat-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.15s; box-shadow: var(--shadow); }
  .cat-row:hover { border-color: var(--navy); box-shadow: var(--shadow-md); }
  .cat-row.done { border-color: var(--green); background: var(--green-light); }
  .cat-row.skipped { opacity: 0.55; }
  .cat-emoji { font-size: 18px; width: 26px; text-align: center; }
  .cat-info { flex: 1; }
  .cat-name { font-size: 13px; font-weight: 600; color: var(--text); }
  .cat-status { font-size: 11px; margin-top: 2px; color: var(--text3); }
  .cat-row.done .cat-status { color: var(--green); font-weight: 500; }
  .cat-badge { font-size: 15px; }

  .form-title { font-family: 'Playfair Display', serif; font-size: 22px; color: var(--navy); margin-bottom: 3px; }
  .form-subtitle { font-size: 12px; color: var(--text2); margin-bottom: 22px; }
  .field-group { display: flex; flex-direction: column; gap: 14px; margin-bottom: 22px; }
  .field-wrap { display: flex; flex-direction: column; }
  .field-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--navy); margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
  .field-input, .field-select { width: 100%; padding: 11px 13px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 8px; color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-shadow: var(--shadow); }
  .field-input:focus, .field-select:focus { border-color: var(--navy); box-shadow: 0 0 0 3px rgba(27,72,134,0.1); }
  .field-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231B4886' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 13px center; padding-right: 34px; background-color: var(--surface); }
  .field-select option { background: white; }

  .address-wrap { position: relative; }
  .address-suggestions { position: absolute; top: 100%; left: 0; right: 0; z-index: 50; background: var(--surface); border: 1.5px solid var(--navy); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; box-shadow: var(--shadow-md); }
  .address-suggestion { padding: 10px 13px; font-size: 13px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.1s; color: var(--text); }
  .address-suggestion:last-child { border-bottom: none; }
  .address-suggestion:hover { background: var(--navy-light); }

  .saving-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--gold); animation: pulse 1s ease infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .saved-check { color: var(--green); font-size: 11px; font-weight: 600; }

  .media-section { margin-bottom: 16px; }
  .media-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; background: var(--surface); border: 1.5px dashed var(--border2); border-radius: 8px; color: var(--text2); font-size: 13px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; font-weight: 500; }
  .media-btn:hover { border-color: var(--navy); color: var(--navy); background: var(--navy-light); }
  .media-btn input { display: none; }
  .media-previews { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .media-preview { position: relative; width: 76px; height: 76px; border-radius: 8px; overflow: hidden; border: 1.5px solid var(--border); box-shadow: var(--shadow); }
  .media-preview img, .media-preview video { width: 100%; height: 100%; object-fit: cover; }
  .media-preview .remove-btn { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; background: rgba(0,0,0,0.6); border-radius: 50%; border: none; color: white; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .upload-progress { font-size: 11px; color: var(--gold); margin-top: 6px; font-weight: 500; }

  .divider { height: 1px; background: var(--border); margin: 4px 0 18px; }

  .type2-items { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .type2-item { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 14px; position: relative; box-shadow: var(--shadow); }
  .type2-item .remove-item { position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--text3); cursor: pointer; font-size: 18px; padding: 2px 5px; border-radius: 4px; transition: color 0.15s; line-height: 1; }
  .type2-item .remove-item:hover { color: var(--danger); }
  .item-field-group { display: flex; flex-direction: column; gap: 10px; padding-right: 22px; }

  .add-item-btn { width: 100%; padding: 11px; border: 1.5px dashed var(--border2); border-radius: var(--radius); background: none; color: var(--navy); font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 7px; margin-bottom: 4px; }
  .add-item-btn:hover { background: var(--navy-light); border-color: var(--navy); }

  .nav-row { display: flex; gap: 8px; margin-top: 10px; padding-bottom: 36px; }
  .btn-primary { flex: 1; padding: 13px; background: var(--navy); color: white; border: none; border-radius: var(--radius); font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; box-shadow: 0 2px 6px rgba(27,72,134,0.25); }
  .btn-primary:hover { background: var(--navy-dark); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { padding: 13px 18px; background: var(--surface); color: var(--text2); border: 1.5px solid var(--border); border-radius: var(--radius); font-family: 'Inter', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.15s; }
  .btn-secondary:hover { border-color: var(--navy); color: var(--navy); }
  .btn-skip { padding: 13px 16px; background: none; color: var(--text2); border: 1.5px solid var(--border); border-radius: var(--radius); font-family: 'Inter', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.15s; }
  .btn-skip:hover { color: var(--gold); border-color: var(--gold); }
  .btn-done { flex: 1; padding: 13px; background: var(--green); color: white; border: none; border-radius: var(--radius); font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; box-shadow: 0 2px 6px rgba(45,106,79,0.25); }
  .btn-done:hover { background: #245a41; }

  .summary-list { display: flex; flex-direction: column; gap: 6px; margin: 14px 0 28px; }
  .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 16px; background: var(--surface); border-radius: 8px; border: 1px solid var(--border); }
  .s-name { font-size: 13px; color: var(--text); }
  .s-done { color: var(--green); font-size: 12px; font-weight: 600; }
  .s-skip { color: var(--text3); font-size: 12px; }
  .s-pending { color: var(--gold); font-size: 12px; }

  .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 14px; color: var(--text2); }
  .spinner { width: 32px; height: 32px; border: 2.5px solid var(--border); border-top-color: var(--navy); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-overlay { position: fixed; inset: 0; background: rgba(247,244,239,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--text2); z-index: 100; font-size: 14px; backdrop-filter: blur(2px); }

  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--navy); border-radius: 20px; padding: 10px 20px; font-size: 13px; color: white; z-index: 200; white-space: nowrap; box-shadow: var(--shadow-md); font-weight: 500; }
  .toast.success { background: var(--green); }
  .toast.error { background: var(--danger); }

  .note-box { background: var(--gold-light); border: 1px solid rgba(196,146,42,0.3); border-radius: 8px; padding: 12px 14px; font-size: 12px; color: var(--gold-dark); margin-bottom: 16px; line-height: 1.5; }
  .empty-state { text-align: center; padding: 40px 20px; color: var(--text3); font-size: 14px; }

  .kitchen-checklist { display: flex; flex-direction: column; border: 1.5px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 16px; box-shadow: var(--shadow); }
  .checklist-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--surface); border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; user-select: none; }
  .checklist-item:last-child { border-bottom: none; }
  .checklist-item.checked { background: var(--green-light); }
  .checklist-check { width: 20px; height: 20px; border: 2px solid var(--border2); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; font-weight: 700; transition: all 0.15s; color: transparent; }
  .checklist-item.checked .checklist-check { background: var(--green); border-color: var(--green); color: white; }
  .checklist-label { font-size: 14px; color: var(--text); transition: color 0.15s; }
  .checklist-item.checked .checklist-label { color: var(--green); font-weight: 500; }

  .amenities-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
  .amenity-chip { padding: 6px 12px; border: 1.5px solid var(--border2); border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; color: var(--text2); user-select: none; }
  .amenity-chip.selected { background: var(--navy); color: white; border-color: var(--navy); }
  .amenity-chip:hover:not(.selected) { border-color: var(--navy); color: var(--navy); }

  .toggle-group { display: flex; gap: 8px; }
  .toggle-btn { flex: 1; padding: 9px; border: 1.5px solid var(--border); border-radius: 8px; background: var(--surface); font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; color: var(--text2); }
  .toggle-btn.active { background: var(--navy); color: white; border-color: var(--navy); }
  .toggle-btn:hover:not(.active) { border-color: var(--navy); color: var(--navy); }

  .bedroom-label { font-size: 13px; font-weight: 700; color: var(--navy); margin-bottom: 10px; letter-spacing: 0.02em; }
  .add-buttons-col { display: flex; flex-direction: column; gap: 8px; }
`;

// ============================================================
// GOOGLE PLACES
// ============================================================
function loadGoogleMaps() {
  if (window.google) return Promise.resolve();
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

function AddressInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [inputVal, setInputVal] = useState(value || "");
  const autocompleteService = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    });
  }, []);

  const handleInput = (val) => {
    setInputVal(val);
    clearTimeout(debounceTimer.current);
    if (val.length < 3) { setSuggestions([]); return; }
    debounceTimer.current = setTimeout(() => {
      autocompleteService.current?.getPlacePredictions(
        { input: val, componentRestrictions: { country: "ca" }, types: ["address"] },
        (results) => setSuggestions(results || [])
      );
    }, 300);
  };

  const selectSuggestion = (s) => {
    setInputVal(s.description); setSuggestions([]); onChange(s.description);
  };

  return (
    <div className="address-wrap">
      <input className="field-input" value={inputVal}
        onChange={e => handleInput(e.target.value)}
        onBlur={() => { onChange(inputVal); setTimeout(() => setSuggestions([]), 200); }}
        placeholder={placeholder || "Start typing address..."} />
      {suggestions.length > 0 && (
        <div className="address-suggestions">
          {suggestions.map(s => (
            <div key={s.place_id} className="address-suggestion" onMouseDown={() => selectSuggestion(s)}>
              {s.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MEDIA UPLOAD
// ============================================================
function MediaUpload({ label, accept, onUploaded, existingUrls = [] }) {
  const [previews, setPreviews] = useState(existingUrls.map(url => ({ url })));
  const [uploading, setUploading] = useState(false);
  const isVideo = accept?.startsWith("video");

  const handleFile = async (file) => {
    const id = Date.now();
    setPreviews(p => [...p, { id, url: URL.createObjectURL(file), uploading: true }]);
    setUploading(true);
    try {
      const cloudUrl = await uploadToCloudinary(file);
      setPreviews(p => p.map(item => item.id === id ? { ...item, url: cloudUrl, uploading: false } : item));
      onUploaded(cloudUrl);
    } catch {
      setPreviews(p => p.filter(item => item.id !== id));
    }
    setUploading(false);
  };

  return (
    <div className="media-section">
      <label className="media-btn">
        {isVideo ? "🎥" : "📷"} {label}
        <input type="file" accept={accept} capture="environment"
          onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      </label>
      {uploading && <div className="upload-progress">Uploading...</div>}
      {previews.length > 0 && (
        <div className="media-previews">
          {previews.map((p, i) => (
            <div key={i} className="media-preview">
              {isVideo ? <video src={p.url} muted playsInline /> : <img src={p.url} alt="" />}
              <button className="remove-btn" onClick={() => setPreviews(pr => pr.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FIELD INPUT
// ============================================================
function FieldInput({ field, value, onChange, saving, saved }) {
  return (
    <div className="field-wrap">
      <div className="field-label">
        {field.key}
        {saving && <span className="saving-dot" />}
        {saved && !saving && <span className="saved-check">✓ Saved</span>}
      </div>
      {field.type === "dropdown" ? (
        <select className="field-select" value={value || ""} onChange={e => onChange(e.target.value)}>
          <option value="">— select —</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "number" ? (
        <input className="field-input" type="number" value={value || ""} onChange={e => onChange(e.target.value)} placeholder="0" />
      ) : (
        <input className="field-input" type="text" value={value || ""} onChange={e => onChange(e.target.value)} placeholder="Enter details..." />
      )}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [properties, setProperties] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentCategoryIdx, setCurrentCategoryIdx] = useState(0);
  const [categoryStatus, setCategoryStatus] = useState({});
  const [formData, setFormData] = useState({});
  const [headerData, setHeaderData] = useState({});
  const [type2Items, setType2Items] = useState({});
  const [notionPageData, setNotionPageData] = useState({});
  const [savingFields, setSavingFields] = useState({});
  const [savedFields, setSavedFields] = useState({});
  const [toast, setToast] = useState(null);
  const [loadingOverlay, setLoadingOverlay] = useState(null);
  const [showNewPropertyForm, setShowNewPropertyForm] = useState(false);
  const [newPropertyData, setNewPropertyData] = useState({ ownerName: "", address: "" });
  const [creatingProperty, setCreatingProperty] = useState(false);
  const [kitchenChecked, setKitchenChecked] = useState({});
  const saveTimers = useRef({});
  const createdDbIds = useRef({});
  const creatingDbPromises = useRef({});

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadProperties = useCallback(async () => {
    setScreen("loading");
    try {
      const data = await notion.query(CONFIG.NOTION_PROPERTIES_DB_ID);
      const props = (data.results || []).map(page => ({
        id: page.id,
        name: page.properties?.["Owner Name"]?.rich_text?.[0]?.plain_text
          || page.properties?.Name?.title?.[0]?.plain_text || "Unnamed",
        address: page.properties?.["Full Address"]?.rich_text?.[0]?.plain_text || "",
      }));
      setProperties(props);
    } catch { showToast("Failed to load properties", "error"); }
    setScreen("properties");
  }, [showToast]);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  const createNewProperty = async () => {
    if (!newPropertyData.ownerName.trim()) { showToast("Owner name is required", "error"); return; }
    if (!newPropertyData.address.trim()) { showToast("Address is required", "error"); return; }
    setCreatingProperty(true);
    try {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(newPropertyData.address)}&key=${CONFIG.GOOGLE_MAPS_API_KEY}`
      );
      const geoData = await geoRes.json();
      if (geoData.status !== "OK") throw new Error("Could not geocode address — check it is valid");
      const { lat, lng } = geoData.results[0].geometry.location;
      const formattedAddress = geoData.results[0].formatted_address;

      const page = await notion.createPage(
        CONFIG.NOTION_PROPERTIES_DB_ID,
        {
          "Address": { title: [{ text: { content: formattedAddress } }] },
          "Owner Name": { rich_text: [{ text: { content: newPropertyData.ownerName } }] },
          "Full Address": { place: { address: formattedAddress, name: formattedAddress, lat, lon: lng } },
        },
        buildPropertyTemplate()
      );
      showToast("Property created ✓");
      setShowNewPropertyForm(false);
      setNewPropertyData({ ownerName: "", address: "" });
      await loadProperties();
      await selectProperty({ id: page.id, name: newPropertyData.ownerName, address: newPropertyData.address });
    } catch (e) { showToast(e.message || "Failed to create property", "error"); }
    setCreatingProperty(false);
  };

  const selectProperty = async (prop) => {
    setSelectedProperty(prop);
    setFormData({}); setHeaderData({}); setType2Items({});
    setCategoryStatus({}); setSavedFields({}); setKitchenChecked({});
    createdDbIds.current = {};
    creatingDbPromises.current = {};
    setLoadingOverlay("Loading property data...");
    try {
      const [page, pageData] = await Promise.all([
        notion.getPage(prop.id),
        parsePropertyPage(prop.id),
      ]);
      const header = {};
      FIELD_APP_HEADER_FIELDS.forEach(field => {
        const p = page.properties?.[field.notion_property];
        if (!p) return;
        if (p.type === "rich_text") header[field.key] = p.rich_text?.[0]?.plain_text || "";
        if (p.type === "title") header[field.key] = p.title?.[0]?.plain_text || "";
        if (p.type === "select") header[field.key] = p.select?.name || "";
        if (p.type === "number") header[field.key] = field.percent ? ((p.number || 0) * 100).toString() : p.number?.toString() || "";
      });
      setHeaderData(header);
      setNotionPageData(pageData);

      const newFormData = {};
      const newType2Items = {};
      let newKitchenChecked = {};
      CATEGORIES.forEach(cat => {
        const section = pageData[cat.notionHeading];
        if (!section) return;
        if (cat.type === 1 && section.type === "simple_table") {
          newFormData[cat.id] = {};
          section.rows.forEach(row => { if (row.col0) newFormData[cat.id][row.col0] = row.col1; });
          if (section.mediaBlocks.length > 0) newFormData[cat.id].media = section.mediaBlocks.map(m => m.url);
        }
        if (cat.type === 2 && section.type === "database") {
          if (cat.id === "kitchen") {
            const checked = {};
            const extras = [];
            section.rows.forEach(row => {
              if (KITCHEN_COMMON_ITEMS.includes(row.item)) {
                checked[row.item] = row.pageId;
              } else {
                extras.push({ id: row.pageId, pageId: row.pageId, isNew: false, subtype: "item",
                  item: row.item, details: row.details, photoUrl: row.photoUrl, videoUrl: row.videoUrl });
              }
            });
            newKitchenChecked = checked;
            newType2Items["kitchen"] = extras;
          } else if (cat.id === "bedroom") {
            newType2Items[cat.id] = section.rows.map(row => {
              if (/^Bedroom \d+/.test(row.item)) {
                return { id: row.pageId, pageId: row.pageId, isNew: false, subtype: "bedroom",
                  bedroomLabel: row.item, item: row.item, ...parseBedroomDetails(row.details) };
              } else if (/^Washroom \d+/.test(row.item)) {
                return { id: row.pageId, pageId: row.pageId, isNew: false, subtype: "washroom",
                  washroomLabel: row.item, item: row.item, ...parseWashroomDetails(row.details) };
              } else {
                return { id: row.pageId, pageId: row.pageId, isNew: false, subtype: "item",
                  item: row.item, details: row.details, photoUrl: row.photoUrl, videoUrl: row.videoUrl };
              }
            });
          } else {
            newType2Items[cat.id] = section.rows.map(row => ({
              id: row.pageId, pageId: row.pageId,
              item: row.item, details: row.details,
              photoUrl: row.photoUrl, videoUrl: row.videoUrl,
            }));
          }
        }
      });
      setFormData(newFormData);
      setType2Items(newType2Items);
      setKitchenChecked(newKitchenChecked);
    } catch { showToast("Could not load existing data", "error"); }
    setLoadingOverlay(null);
    setScreen("step0");
  };

  const handleHeaderChange = async (key, value) => {
    setHeaderData(d => ({ ...d, [key]: value }));
    const saveKey = `header_${key}`;
    clearTimeout(saveTimers.current[saveKey]);
    setSavingFields(s => ({ ...s, [saveKey]: true }));
    saveTimers.current[saveKey] = setTimeout(async () => {
      try {
        const field = FIELD_APP_HEADER_FIELDS.find(f => f.key === key);
        if (!field || !selectedProperty) return;
        let propValue;
        if (field.type === "dropdown") propValue = { select: { name: value } };
        else if (field.type === "number") propValue = { number: field.percent ? (parseFloat(value) || 0) / 100 : parseFloat(value) || 0 };
        else propValue = { rich_text: [{ text: { content: value } }] };
        await notion.updatePage(selectedProperty.id, { [field.notion_property]: propValue });
        setSavingFields(s => ({ ...s, [saveKey]: false }));
        setSavedFields(s => ({ ...s, [saveKey]: true }));
      } catch {
        setSavingFields(s => ({ ...s, [saveKey]: false }));
        showToast("Save failed", "error");
      }
    }, 800);
  };

  const handleFieldChange = async (categoryId, fieldKey, value) => {
    setFormData(d => ({ ...d, [categoryId]: { ...(d[categoryId] || {}), [fieldKey]: value } }));
    const saveKey = `${categoryId}_${fieldKey}`;
    clearTimeout(saveTimers.current[saveKey]);
    setSavingFields(s => ({ ...s, [saveKey]: true }));
    saveTimers.current[saveKey] = setTimeout(async () => {
      try {
        const cat = CATEGORIES.find(c => c.id === categoryId);
        const section = notionPageData[cat.notionHeading];
        if (!section) return;
        const row = section.rows.find(r => r.col0 === fieldKey);
        if (row?.blockId) {
          await notion.updateBlock(row.blockId, {
            table_row: { cells: [[{ type: "text", text: { content: fieldKey } }], [{ type: "text", text: { content: value } }]] }
          });
        }
        setSavingFields(s => ({ ...s, [saveKey]: false }));
        setSavedFields(s => ({ ...s, [saveKey]: true }));
      } catch {
        setSavingFields(s => ({ ...s, [saveKey]: false }));
        showToast("Save failed", "error");
      }
    }, 800);
  };

  const handleMediaUploaded = async (categoryId, url, isVideo) => {
    setFormData(d => ({ ...d, [categoryId]: { ...(d[categoryId] || {}), media: [...((d[categoryId] || {}).media || []), url] } }));
    try {
      const cat = CATEGORIES.find(c => c.id === categoryId);
      const section = notionPageData[cat.notionHeading];
      if (!section) return;
      const block = isVideo
        ? { type: "video", video: { type: "external", external: { url } } }
        : { type: "image", image: { type: "external", external: { url } } };
      await notion.appendBlocks(section.blockId, [block]);
      showToast(isVideo ? "Video saved ✓" : "Photo saved ✓");
    } catch { showToast("Media save failed", "error"); }
  };

  const addType2Item = (categoryId) => {
    setType2Items(d => ({ ...d, [categoryId]: [...(d[categoryId] || []), { subtype: "item", item: "", details: "", photoUrl: null, videoUrl: null, id: Date.now(), isNew: true }] }));
  };

  const addBedroomItem = (categoryId) => {
    setType2Items(d => {
      const cur = d[categoryId] || [];
      const count = cur.filter(i => i.subtype === "bedroom").length + 1;
      const label = `Bedroom ${count}`;
      return { ...d, [categoryId]: [...cur, { subtype: "bedroom", id: Date.now(), isNew: true,
        bedroomLabel: label, item: label, bedSize: "", floor: "", amenities: [], ensuite: "No", showerType: "" }] };
    });
  };

  const addWashroomItem = (categoryId) => {
    setType2Items(d => {
      const cur = d[categoryId] || [];
      const count = cur.filter(i => i.subtype === "washroom").length + 1;
      const label = `Washroom ${count}`;
      return { ...d, [categoryId]: [...cur, { subtype: "washroom", id: Date.now(), isNew: true,
        washroomLabel: label, item: label, showerType: "", details: "" }] };
    });
  };

  const toggleKitchenItem = async (itemName) => {
    if (kitchenChecked[itemName]) {
      const pageId = kitchenChecked[itemName];
      setKitchenChecked(c => { const n = { ...c }; delete n[itemName]; return n; });
      if (pageId && pageId !== "__pending__") {
        try { await notion.archivePage(pageId); } catch { /* silent */ }
      }
    } else {
      setKitchenChecked(c => ({ ...c, [itemName]: "__pending__" }));
      try {
        const kitchenSection = notionPageData["Kitchen & Appliances"];
        let tableBlockId = kitchenSection?.tableBlockId || createdDbIds.current["Kitchen & Appliances"];
        if (!tableBlockId) {
          if (!creatingDbPromises.current["Kitchen & Appliances"]) {
            creatingDbPromises.current["Kitchen & Appliances"] = notion.createDatabase(
              selectedProperty.id, "Kitchen & Appliances", TYPE2_DB_SCHEMAS.kitchen
            ).then(db => {
              createdDbIds.current["Kitchen & Appliances"] = db.id;
              setNotionPageData(prev => ({
                ...prev,
                "Kitchen & Appliances": { ...(prev["Kitchen & Appliances"] || { blockId: null, rows: [], mediaBlocks: [] }), tableBlockId: db.id, type: "database" },
              }));
              return db.id;
            });
          }
          tableBlockId = await creatingDbPromises.current["Kitchen & Appliances"];
        }
        const newPage = await notion.createDatabaseRow(tableBlockId, {
          Item: { title: [{ text: { content: itemName } }] },
        });
        setKitchenChecked(c => ({ ...c, [itemName]: newPage.id }));
      } catch { showToast("Save failed", "error"); }
    }
  };

  const updateType2Item = async (categoryId, itemId, field, value) => {
    setType2Items(d => ({ ...d, [categoryId]: d[categoryId].map(i => i.id === itemId ? { ...i, [field]: value } : i) }));
    const saveKey = `${categoryId}_${itemId}_${field}`;
    clearTimeout(saveTimers.current[saveKey]);
    setSavingFields(s => ({ ...s, [saveKey]: true }));
    saveTimers.current[saveKey] = setTimeout(async () => {
      try {
        const cat = CATEGORIES.find(c => c.id === categoryId);
        const section = notionPageData[cat.notionHeading];
        let tableBlockId = section?.tableBlockId || createdDbIds.current[cat.notionHeading];
        if (!tableBlockId) {
          if (!creatingDbPromises.current[cat.notionHeading]) {
            const schema = TYPE2_DB_SCHEMAS[cat.id] || { "Item": { "title": {} } };
            creatingDbPromises.current[cat.notionHeading] = notion.createDatabase(selectedProperty.id, cat.title, schema)
              .then(db => {
                createdDbIds.current[cat.notionHeading] = db.id;
                setNotionPageData(prev => ({
                  ...prev,
                  [cat.notionHeading]: { ...(prev[cat.notionHeading] || { blockId: null, rows: [], mediaBlocks: [] }), tableBlockId: db.id, type: "database" },
                }));
                return db.id;
              });
          }
          tableBlockId = await creatingDbPromises.current[cat.notionHeading];
        }
        let latestItem;
        setType2Items(current => {
          latestItem = (current[categoryId] || []).find(i => i.id === itemId);
          return current;
        });
        if (!latestItem) return;
        let props;
        if (latestItem.subtype === "bedroom") {
          props = { Item: { title: [{ text: { content: latestItem.bedroomLabel || latestItem.item || "" } }] } };
          if (latestItem.floor) props["Floor"] = { select: { name: latestItem.floor } };
          if (latestItem.bedSize) props["Bed Size"] = { select: { name: latestItem.bedSize } };
          if (latestItem.amenities?.length) props["Amenities"] = { multi_select: latestItem.amenities.map(a => ({ name: a })) };
          props["Ensuite"] = { select: { name: latestItem.ensuite || "No" } };
          if (latestItem.showerType) props["Shower Type"] = { select: { name: latestItem.showerType } };
        } else if (latestItem.subtype === "washroom") {
          props = { Item: { title: [{ text: { content: latestItem.washroomLabel || latestItem.item || "" } }] } };
          if (latestItem.showerType) props["Shower Type"] = { select: { name: latestItem.showerType } };
        } else {
          props = { Item: { title: [{ text: { content: latestItem.item || "" } }] } };
          if (cat.columns.includes("Details") && latestItem.details) props["Details"] = { rich_text: [{ text: { content: latestItem.details } }] };
        }
        if (latestItem.pageId && !latestItem.isNew) {
          await notion.updatePage(latestItem.pageId, props);
        } else {
          const newPage = await notion.createDatabaseRow(tableBlockId, props);
          setType2Items(d => ({ ...d, [categoryId]: d[categoryId].map(i => i.id === itemId ? { ...i, pageId: newPage.id, isNew: false } : i) }));
        }
        setSavingFields(s => ({ ...s, [saveKey]: false }));
        setSavedFields(s => ({ ...s, [saveKey]: true }));
      } catch (e) {
        setSavingFields(s => ({ ...s, [saveKey]: false }));
        showToast(e.message || "Save failed", "error");
      }
    }, 800);
  };

  const removeType2Item = (categoryId, itemId) => {
    setType2Items(d => ({ ...d, [categoryId]: d[categoryId].filter(i => i.id !== itemId) }));
  };

  const markDone = (id) => { setCategoryStatus(s => ({ ...s, [id]: "done" })); setScreen("overview"); };
  const markSkipped = (id) => { setCategoryStatus(s => ({ ...s, [id]: "skipped" })); setScreen("overview"); };
  const openCategory = (idx) => { setCurrentCategoryIdx(idx); setScreen("category"); };

  const filteredProps = properties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address.toLowerCase().includes(search.toLowerCase())
  );

  const completedCount = Object.values(categoryStatus).filter(v => v === "done").length;
  const totalCategories = CATEGORIES.length;
  const progressPct = screen === "step0" ? 0 : Math.round((completedCount / totalCategories) * 100);
  const currentCategory = CATEGORIES[currentCategoryIdx];

  return (
    <>
      <style>{css}</style>
      <div className="app">

        <div className="app-header">
          <div className="header-top">
            <div>
              <div className="logo">Opulent <span>Stays</span></div>
              <div className="subtitle">Field Operations</div>
            </div>
            {screen !== "properties" && screen !== "loading" && (
              <button className="btn-back-header" onClick={() => setScreen("properties")}>← Properties</button>
            )}
          </div>
          {screen !== "properties" && screen !== "loading" && (
            <>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
              <div className="progress-label">
                {screen === "step0" ? `Property info — Step 0 of ${totalCategories + 1}`
                  : screen === "summary" ? "Complete ✓"
                  : `${completedCount} of ${totalCategories} categories complete`}
              </div>
            </>
          )}
        </div>

        {screen === "loading" && <div className="loading"><div className="spinner" /><span>Loading properties...</span></div>}

        {screen === "properties" && (
          <div className="screen">
            <div className="list-header">
              <div>
                <div className="screen-title">Properties</div>
                <div className="screen-sub">{properties.length} active listings</div>
              </div>
              <button className="btn-new-property" onClick={() => setShowNewPropertyForm(v => !v)}>+ New</button>
            </div>

            {showNewPropertyForm && (
              <div className="new-property-card">
                <div className="new-property-title">Add New Property</div>
                <div className="field-wrap">
                  <div className="field-label">Owner Name</div>
                  <input className="field-input" placeholder="e.g. John & Sarah"
                    value={newPropertyData.ownerName}
                    onChange={e => setNewPropertyData(d => ({ ...d, ownerName: e.target.value }))} />
                </div>
                <div className="field-wrap" style={{ marginTop: 12 }}>
                  <div className="field-label">Full Address</div>
                  <AddressInput value={newPropertyData.address} placeholder="Start typing address..."
                    onChange={val => setNewPropertyData(d => ({ ...d, address: val }))} />
                </div>
                <div className="new-property-row">
                  <button className="btn-secondary" onClick={() => setShowNewPropertyForm(false)}>Cancel</button>
                  <button className="btn-primary" onClick={createNewProperty} disabled={creatingProperty}>
                    {creatingProperty ? "Creating..." : "Create & Start →"}
                  </button>
                </div>
              </div>
            )}

            <input className="search-box" placeholder="Search by name or address..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="property-list">
              {filteredProps.length === 0 && <div className="empty-state">No properties found</div>}
              {filteredProps.map(p => (
                <div key={p.id} className="property-card" onClick={() => selectProperty(p)}>
                  <div><div className="p-name">{p.name}</div><div className="p-addr">{p.address}</div></div>
                  <div className="arrow">›</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "step0" && (
          <div className="screen">
            <div className="form-title">Property Info</div>
            <div className="form-subtitle">{selectedProperty?.name} · {selectedProperty?.address}</div>
            <div className="field-group">
              {FIELD_APP_HEADER_FIELDS.map(field => (
                <div key={field.key}>
                  {field.type === "address" ? (
                    <>
                      <div className="field-label">
                        {field.key}
                        {savingFields[`header_${field.key}`] && <span className="saving-dot" />}
                        {savedFields[`header_${field.key}`] && !savingFields[`header_${field.key}`] && <span className="saved-check">✓ Saved</span>}
                      </div>
                      <AddressInput value={headerData[field.key]} onChange={val => handleHeaderChange(field.key, val)} />
                    </>
                  ) : (
                    <FieldInput field={field} value={headerData[field.key]} onChange={val => handleHeaderChange(field.key, val)}
                      saving={savingFields[`header_${field.key}`]} saved={savedFields[`header_${field.key}`]} />
                  )}
                </div>
              ))}
            </div>
            <div className="nav-row">
              <button className="btn-secondary" onClick={() => setScreen("properties")}>← Back</button>
              <button className="btn-primary" onClick={() => setScreen("overview")}>Continue to Categories →</button>
            </div>
          </div>
        )}

        {screen === "overview" && (
          <div className="screen">
            <div className="form-title">{selectedProperty?.name}</div>
            <div className="form-subtitle">{selectedProperty?.address}</div>
            <div className="category-overview">
              {CATEGORIES.map((cat, idx) => {
                const status = categoryStatus[cat.id];
                return (
                  <div key={cat.id} className={`cat-row ${status === "done" ? "done" : status === "skipped" ? "skipped" : ""}`} onClick={() => openCategory(idx)}>
                    <div className="cat-emoji">{cat.emoji}</div>
                    <div className="cat-info">
                      <div className="cat-name">{cat.title}</div>
                      <div className="cat-status">{status === "done" ? "Completed" : status === "skipped" ? "Skipped" : "Not started"}</div>
                    </div>
                    <div className="cat-badge">{status === "done" ? "✅" : status === "skipped" ? "⏭️" : "›"}</div>
                  </div>
                );
              })}
            </div>
            <div className="nav-row">
              <button className="btn-secondary" onClick={() => setScreen("step0")}>← Property Info</button>
              <button className="btn-primary" onClick={() => setScreen("summary")}>View Summary →</button>
            </div>
          </div>
        )}

        {screen === "category" && currentCategory && (
          <div className="screen">
            <div className="form-title">{currentCategory.emoji} {currentCategory.title}</div>
            <div className="form-subtitle">Category {currentCategory.order} of {totalCategories} · {selectedProperty?.name}</div>

            {currentCategory.type === 1 && (
              <>
                <div className="field-group">
                  {currentCategory.fields.map(field => {
                    const saveKey = `${currentCategory.id}_${field.key}`;
                    return <FieldInput key={field.key} field={field}
                      value={(formData[currentCategory.id] || {})[field.key]}
                      onChange={val => handleFieldChange(currentCategory.id, field.key, val)}
                      saving={savingFields[saveKey]} saved={savedFields[saveKey]} />;
                  })}
                </div>
                <div className="divider" />
                <MediaUpload label="Add Photo" accept="image/*"
                  onUploaded={url => handleMediaUploaded(currentCategory.id, url, false)}
                  existingUrls={(formData[currentCategory.id]?.media || []).filter(u => !u.includes("/video/"))} />
                <MediaUpload label="Add Video" accept="video/*"
                  onUploaded={url => handleMediaUploaded(currentCategory.id, url, true)}
                  existingUrls={(formData[currentCategory.id]?.media || []).filter(u => u.includes("/video/"))} />
              </>
            )}

            {currentCategory.type === 2 && currentCategory.id !== "kitchen" && currentCategory.id !== "bedroom" && (
              <>
                <div className="note-box">Each item saves immediately to Notion. Tap + Add Item for each appliance, fixture, or amenity.</div>
                <div className="type2-items">
                  {(type2Items[currentCategory.id] || []).map((item) => (
                    <div key={item.id} className="type2-item">
                      <button className="remove-item" onClick={() => removeType2Item(currentCategory.id, item.id)}>×</button>
                      <div className="item-field-group">
                        <FieldInput field={{ key: "Item", type: "text" }} value={item.item}
                          onChange={val => updateType2Item(currentCategory.id, item.id, "item", val)}
                          saving={savingFields[`${currentCategory.id}_${item.id}_item`]}
                          saved={savedFields[`${currentCategory.id}_${item.id}_item`]} />
                        {currentCategory.columns.includes("Details") && (
                          <FieldInput field={{ key: "Details", type: "text" }} value={item.details}
                            onChange={val => updateType2Item(currentCategory.id, item.id, "details", val)}
                            saving={savingFields[`${currentCategory.id}_${item.id}_details`]}
                            saved={savedFields[`${currentCategory.id}_${item.id}_details`]} />
                        )}
                        <MediaUpload label="Add Photo" accept="image/*"
                          onUploaded={url => updateType2Item(currentCategory.id, item.id, "photoUrl", url)}
                          existingUrls={item.photoUrl ? [item.photoUrl] : []} />
                        <MediaUpload label="Add Video" accept="video/*"
                          onUploaded={url => updateType2Item(currentCategory.id, item.id, "videoUrl", url)}
                          existingUrls={item.videoUrl ? [item.videoUrl] : []} />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="add-item-btn" onClick={() => addType2Item(currentCategory.id)}>+ Add Item</button>
              </>
            )}

            {currentCategory.id === "kitchen" && (
              <>
                <div className="note-box">Tap to select appliances this property has. Selections save to Notion automatically.</div>
                <div className="kitchen-checklist">
                  {KITCHEN_COMMON_ITEMS.map(appliance => (
                    <div key={appliance}
                      className={`checklist-item${kitchenChecked[appliance] ? " checked" : ""}`}
                      onClick={() => toggleKitchenItem(appliance)}>
                      <div className="checklist-check">{kitchenChecked[appliance] ? "✓" : ""}</div>
                      <div className="checklist-label">{appliance}</div>
                    </div>
                  ))}
                </div>
                <div className="divider" />
                {(type2Items["kitchen"] || []).length > 0 && (
                  <div className="type2-items">
                    {(type2Items["kitchen"] || []).map(item => (
                      <div key={item.id} className="type2-item">
                        <button className="remove-item" onClick={() => removeType2Item("kitchen", item.id)}>×</button>
                        <div className="item-field-group">
                          <FieldInput field={{ key: "Item", type: "text" }} value={item.item}
                            onChange={val => updateType2Item("kitchen", item.id, "item", val)}
                            saving={savingFields[`kitchen_${item.id}_item`]}
                            saved={savedFields[`kitchen_${item.id}_item`]} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button className="add-item-btn" onClick={() => addType2Item("kitchen")}>+ Add Item</button>
              </>
            )}

            {currentCategory.id === "bedroom" && (
              <>
                <div className="type2-items">
                  {(type2Items["bedroom"] || []).map(item => {
                    if (item.subtype === "bedroom") {
                      return (
                        <div key={item.id} className="type2-item">
                          <button className="remove-item" onClick={() => removeType2Item("bedroom", item.id)}>×</button>
                          <div className="item-field-group">
                            <div className="bedroom-label">{item.bedroomLabel}</div>
                            <div className="field-wrap">
                              <div className="field-label">Bed Size</div>
                              <select className="field-select" value={item.bedSize || ""}
                                onChange={e => updateType2Item("bedroom", item.id, "bedSize", e.target.value)}>
                                <option value="">— select —</option>
                                {["Single", "Double", "Queen", "King", "Cali King"].map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                            <div className="field-wrap">
                              <div className="field-label">Floor</div>
                              <select className="field-select" value={item.floor || ""}
                                onChange={e => updateType2Item("bedroom", item.id, "floor", e.target.value)}>
                                <option value="">— select —</option>
                                {["Basement", "Main Floor", "2nd Floor", "3rd Floor"].map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                            <div className="field-wrap">
                              <div className="field-label">Room Features</div>
                              <div className="amenities-grid">
                                {["Closet", "Night Stand", "Lamp", "Luggage Stand"].map(a => (
                                  <div key={a}
                                    className={`amenity-chip${(item.amenities || []).includes(a) ? " selected" : ""}`}
                                    onClick={() => {
                                      const cur = item.amenities || [];
                                      const next = cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a];
                                      updateType2Item("bedroom", item.id, "amenities", next);
                                    }}>
                                    {a}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="field-wrap">
                              <div className="field-label">Ensuite</div>
                              <div className="toggle-group">
                                {["Yes", "No"].map(v => (
                                  <button key={v}
                                    className={`toggle-btn${item.ensuite === v ? " active" : ""}`}
                                    onClick={() => updateType2Item("bedroom", item.id, "ensuite", v)}>
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {item.ensuite === "Yes" && (
                              <div className="field-wrap">
                                <div className="field-label">Shower Type</div>
                                <select className="field-select" value={item.showerType || ""}
                                  onChange={e => updateType2Item("bedroom", item.id, "showerType", e.target.value)}>
                                  <option value="">— select —</option>
                                  {["Bathtub", "Standing", "Both"].map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    } else if (item.subtype === "washroom") {
                      return (
                        <div key={item.id} className="type2-item">
                          <button className="remove-item" onClick={() => removeType2Item("bedroom", item.id)}>×</button>
                          <div className="item-field-group">
                            <div className="bedroom-label">{item.washroomLabel}</div>
                            <div className="field-wrap">
                              <div className="field-label">Shower Type</div>
                              <select className="field-select" value={item.showerType || ""}
                                onChange={e => updateType2Item("bedroom", item.id, "showerType", e.target.value)}>
                                <option value="">— select —</option>
                                {["Bathtub", "Standing", "Both"].map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                            <FieldInput field={{ key: "Description", type: "text" }} value={item.details || ""}
                              onChange={val => updateType2Item("bedroom", item.id, "details", val)}
                              saving={savingFields[`bedroom_${item.id}_details`]}
                              saved={savedFields[`bedroom_${item.id}_details`]} />
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={item.id} className="type2-item">
                          <button className="remove-item" onClick={() => removeType2Item("bedroom", item.id)}>×</button>
                          <div className="item-field-group">
                            <FieldInput field={{ key: "Item", type: "text" }} value={item.item}
                              onChange={val => updateType2Item("bedroom", item.id, "item", val)}
                              saving={savingFields[`bedroom_${item.id}_item`]}
                              saved={savedFields[`bedroom_${item.id}_item`]} />
                            <FieldInput field={{ key: "Details", type: "text" }} value={item.details}
                              onChange={val => updateType2Item("bedroom", item.id, "details", val)}
                              saving={savingFields[`bedroom_${item.id}_details`]}
                              saved={savedFields[`bedroom_${item.id}_details`]} />
                            <MediaUpload label="Add Photo" accept="image/*"
                              onUploaded={url => updateType2Item("bedroom", item.id, "photoUrl", url)}
                              existingUrls={item.photoUrl ? [item.photoUrl] : []} />
                            <MediaUpload label="Add Video" accept="video/*"
                              onUploaded={url => updateType2Item("bedroom", item.id, "videoUrl", url)}
                              existingUrls={item.videoUrl ? [item.videoUrl] : []} />
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
                <div className="add-buttons-col">
                  <button className="add-item-btn" onClick={() => addBedroomItem("bedroom")}>🛏 + Add Bedroom</button>
                  <button className="add-item-btn" onClick={() => addWashroomItem("bedroom")}>🚿 + Add Washroom</button>
                  <button className="add-item-btn" onClick={() => addType2Item("bedroom")}>+ Add Item</button>
                </div>
              </>
            )}

            <div className="nav-row">
              <button className="btn-secondary" onClick={() => setScreen("overview")}>← Overview</button>
              <button className="btn-skip" onClick={() => markSkipped(currentCategory.id)}>Skip</button>
              <button className="btn-done" onClick={() => markDone(currentCategory.id)}>Done ✓</button>
            </div>
          </div>
        )}

        {screen === "summary" && (
          <div className="screen">
            <div className="form-title">Summary</div>
            <div className="form-subtitle">{selectedProperty?.name} · {selectedProperty?.address}</div>
            <div className="summary-list">
              {CATEGORIES.map(cat => {
                const status = categoryStatus[cat.id];
                return (
                  <div key={cat.id} className="summary-row">
                    <div className="s-name">{cat.emoji} {cat.title}</div>
                    <div className={status === "done" ? "s-done" : status === "skipped" ? "s-skip" : "s-pending"}>
                      {status === "done" ? "✓ Done" : status === "skipped" ? "Skipped" : "Not started"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="nav-row">
              <button className="btn-secondary" onClick={() => setScreen("overview")}>← Back</button>
              <button className="btn-primary" onClick={() => { showToast("Property complete! 🎉"); setScreen("properties"); }}>
                Finish & Exit
              </button>
            </div>
          </div>
        )}

        {loadingOverlay && <div className="loading-overlay"><div className="spinner" /><span>{loadingOverlay}</span></div>}
        {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      </div>
    </>
  );
}
