db = db.getSiblingDB('paisatracker');

try {
  db.createCollection('transactions');
} catch (e) {}

try {
  db.createCollection('settings');
} catch (e) {}
