# Petals

A private web app for shopping lists, wish lists, and bucket lists. There is no account. Your lists live on the server, keyed to a long-lived device cookie, and can be shared with unguessable links.

## How to run

You need Node.js 22 or newer (the app uses the built-in `node:sqlite` module) and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first visit creates a private device key (httpOnly cookie) and seeds a few demo lists.

Production:

```bash
npm run build
npm start
```

Data is stored in `data/petals.db`. Uploads are stored in `data/uploads/` under unguessable filenames. Both folders are gitignored.

## What’s in the app

Two primary sections:

- **Shopping / Wish** — shopping lists and wish lists, with optional budgets
- **Bucket list** — bucket lists; to-do and custom lists live here too

Catch and Settings sit in the sidebar.

You can still:

- Search, filter, pin, archive, duplicate, and delete lists
- Open a list in List, Mood, Timeline, or Memories views
- Add items with notes, dates, tags, attachments, shop links, and private notes
- Capture links (with editable product metadata), export mood boards, share view-only or editable links, restore versions, and import/export JSON

## Sharing

A share link never exposes the dashboard. Private notes are stripped from shared views. Attachments default to hidden from shares when uploaded from the item editor; toggle **shared** per file. Regenerating a link invalidates the previous token.

## Demo seed

New devices receive:

- Autumn in the city (bucket list)
- Home things I love (wish list with budget)
- Weekend grocery notes (shopping list)
