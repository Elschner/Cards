#!/bin/bash
# Dobbeltklik for at starte CardOps (Mac). Lad vinduet være åbent mens du bruger appen.
# Luk vinduet (eller tryk Ctrl+C) for at stoppe.
cd "$(dirname "$0")" || exit 1

echo "=== CardOps ==="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js er ikke installeret. Hent 'LTS' fra https://nodejs.org og prøv igen."
  read -r -p "Tryk Enter for at lukke..."; exit 1
fi

echo "1/4 Henter seneste version fra GitHub..."
# Kun koden opdateres. Dine data (dev.db, uploads/) og indstillinger (.env) røres ikke.
if git fetch -q origin main 2>/dev/null; then
  git reset -q --hard origin/main
else
  echo "   (kunne ikke hente opdateringer – fortsætter med den version du har)"
fi

[ -f .env ] || cp .env.example .env

echo "2/4 Installerer pakker (første gang tager det et par minutter)..."
if ! npm install --no-fund --no-audit --loglevel=error; then
  echo "Installationen fejlede. Tag et skærmbillede af den røde tekst og send det til Claude."
  read -r -p "Tryk Enter for at lukke..."; exit 1
fi

echo "3/4 Klargør database..."
if ! npx prisma db push --skip-generate >/dev/null || ! npx prisma generate >/dev/null; then
  echo "Databasen kunne ikke klargøres. Send et skærmbillede til Claude."
  read -r -p "Tryk Enter for at lukke..."; exit 1
fi

echo "4/4 Starter CardOps – browseren åbner om lidt."
( until curl -s -o /dev/null http://localhost:3000; do sleep 1; done; open http://localhost:3000 ) &
npm run dev
