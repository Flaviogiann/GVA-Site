/* =========================================================
   Le programme des vols du jour, pour la section « Vos vols en
   temps réel ».

   Le site n'a pas de vrai système de vols derrière lui : ce
   fichier liste les vols d'une journée type, avec leur heure
   prévue. js/vols.js en déduit le statut de chaque vol d'après
   l'heure de Genève, et le programme se répète chaque jour.

   Champs :
   - heure     heure prévue, « HH:MM », heure de Genève
   - lieu      destination (départs) ou provenance (arrivées),
               affichée dans le tableau
   - court     nom court de la ville, pour les cartes du téléphone
   - code      code IATA de l'aéroport (cartes et recherche)
   - vol       numéro de vol ; les deux premières lettres désignent
               la compagnie (voir COMPAGNIES)
   - porte     porte d'embarquement ou de sortie
   - terminal  « Principal » ou « Jetée »
   - retard    (facultatif) retard annoncé au départ, en minutes
   - annule    (facultatif) true si le vol est annulé

   Données de démonstration : les six premiers départs sont ceux de
   la maquette, le reste est inventé.
   ========================================================= */

export const COMPAGNIES = {
  AF: 'Air France',
  AZ: 'ITA Airways',
  BA: 'British Airways',
  EK: 'Emirates',
  IB: 'Iberia',
  KL: 'KLM',
  LH: 'Lufthansa',
  LX: 'Swiss',
  SK: 'SAS',
  SN: 'Brussels Airlines',
  TK: 'Turkish Airlines',
  TP: 'TAP Air Portugal',
  U2: 'easyJet',
  VY: 'Vueling',
};

export const DEPARTS = [
  { heure: '06:10', lieu: 'Londres Heathrow', court: 'Londres', code: 'LHR', vol: 'LX 348', porte: 'B24', terminal: 'Principal' },
  { heure: '06:35', lieu: 'Paris Charles-de-Gaulle', court: 'Paris', code: 'CDG', vol: 'AF 1243', porte: 'A11', terminal: 'Principal' },
  { heure: '07:05', lieu: 'Barcelone El Prat', court: 'Barcelone', code: 'BCN', vol: 'VY 6621', porte: 'C08', terminal: 'Principal', retard: 25 },
  { heure: '07:20', lieu: 'Amsterdam Schiphol', court: 'Amsterdam', code: 'AMS', vol: 'KL 1928', porte: 'B12', terminal: 'Principal' },
  { heure: '07:45', lieu: 'Lisbonne Humberto Delgado', court: 'Lisbonne', code: 'LIS', vol: 'TP 933', porte: 'D02', terminal: 'Jetée' },
  { heure: '08:15', lieu: 'Zurich', court: 'Zurich', code: 'ZRH', vol: 'LX 2803', porte: 'A03', terminal: 'Principal' },
  { heure: '08:50', lieu: 'Londres Gatwick', court: 'Londres', code: 'LGW', vol: 'U2 2218', porte: 'D07', terminal: 'Jetée', annule: true },
  { heure: '09:25', lieu: 'Francfort', court: 'Francfort', code: 'FRA', vol: 'LH 1207', porte: 'B05', terminal: 'Principal' },
  { heure: '10:05', lieu: 'Madrid Barajas', court: 'Madrid', code: 'MAD', vol: 'IB 3509', porte: 'C11', terminal: 'Principal' },
  { heure: '10:40', lieu: 'Bruxelles', court: 'Bruxelles', code: 'BRU', vol: 'SN 2706', porte: 'A07', terminal: 'Principal' },
  { heure: '11:20', lieu: 'Istanbul', court: 'Istanbul', code: 'IST', vol: 'TK 1914', porte: 'D04', terminal: 'Jetée' },
  { heure: '12:00', lieu: 'Rome Fiumicino', court: 'Rome', code: 'FCO', vol: 'AZ 289', porte: 'C12', terminal: 'Principal' },
  { heure: '12:35', lieu: "Nice Côte d'Azur", court: 'Nice', code: 'NCE', vol: 'AF 1317', porte: 'A10', terminal: 'Principal' },
  { heure: '13:15', lieu: 'Londres Heathrow', court: 'Londres', code: 'LHR', vol: 'BA 729', porte: 'B21', terminal: 'Principal' },
  { heure: '14:00', lieu: 'Copenhague', court: 'Copenhague', code: 'CPH', vol: 'SK 618', porte: 'A09', terminal: 'Principal' },
  { heure: '14:45', lieu: 'Dubaï', court: 'Dubaï', code: 'DXB', vol: 'EK 86', porte: 'D01', terminal: 'Jetée' },
  { heure: '15:30', lieu: 'Amsterdam Schiphol', court: 'Amsterdam', code: 'AMS', vol: 'KL 1930', porte: 'B14', terminal: 'Principal' },
  { heure: '16:10', lieu: 'Barcelone El Prat', court: 'Barcelone', code: 'BCN', vol: 'VY 6623', porte: 'C06', terminal: 'Principal' },
  { heure: '17:00', lieu: 'Paris Charles-de-Gaulle', court: 'Paris', code: 'CDG', vol: 'AF 1245', porte: 'A12', terminal: 'Principal' },
  { heure: '17:45', lieu: 'Zurich', court: 'Zurich', code: 'ZRH', vol: 'LX 2805', porte: 'A04', terminal: 'Principal' },
  { heure: '18:30', lieu: 'Lisbonne Humberto Delgado', court: 'Lisbonne', code: 'LIS', vol: 'TP 935', porte: 'D03', terminal: 'Jetée' },
  { heure: '19:15', lieu: 'Londres Heathrow', court: 'Londres', code: 'LHR', vol: 'LX 350', porte: 'B26', terminal: 'Principal' },
  { heure: '20:05', lieu: 'Madrid Barajas', court: 'Madrid', code: 'MAD', vol: 'IB 3511', porte: 'C10', terminal: 'Principal' },
  { heure: '21:00', lieu: 'Francfort', court: 'Francfort', code: 'FRA', vol: 'LH 1211', porte: 'B07', terminal: 'Principal' },
  { heure: '22:05', lieu: 'Zurich', court: 'Zurich', code: 'ZRH', vol: 'LX 2809', porte: 'A05', terminal: 'Principal' },
];

export const ARRIVEES = [
  { heure: '06:05', lieu: 'Londres Heathrow', court: 'Londres', code: 'LHR', vol: 'BA 725', porte: 'B22', terminal: 'Principal' },
  { heure: '06:30', lieu: 'Paris Charles-de-Gaulle', court: 'Paris', code: 'CDG', vol: 'AF 1242', porte: 'A09', terminal: 'Principal' },
  { heure: '06:55', lieu: 'Amsterdam Schiphol', court: 'Amsterdam', code: 'AMS', vol: 'KL 1927', porte: 'B10', terminal: 'Principal' },
  { heure: '07:25', lieu: 'Zurich', court: 'Zurich', code: 'ZRH', vol: 'LX 2800', porte: 'A02', terminal: 'Principal' },
  { heure: '07:50', lieu: 'Madrid Barajas', court: 'Madrid', code: 'MAD', vol: 'IB 3508', porte: 'C09', terminal: 'Principal' },
  { heure: '08:20', lieu: 'Bruxelles', court: 'Bruxelles', code: 'BRU', vol: 'SN 2705', porte: 'A06', terminal: 'Principal' },
  { heure: '08:55', lieu: 'Barcelone El Prat', court: 'Barcelone', code: 'BCN', vol: 'VY 6620', porte: 'C07', terminal: 'Principal', retard: 15 },
  { heure: '09:30', lieu: 'Lisbonne Humberto Delgado', court: 'Lisbonne', code: 'LIS', vol: 'TP 932', porte: 'D01', terminal: 'Jetée' },
  { heure: '10:10', lieu: 'Francfort', court: 'Francfort', code: 'FRA', vol: 'LH 1206', porte: 'B04', terminal: 'Principal' },
  { heure: '10:50', lieu: 'Londres Gatwick', court: 'Londres', code: 'LGW', vol: 'U2 2217', porte: 'D06', terminal: 'Jetée' },
  { heure: '11:30', lieu: 'Istanbul', court: 'Istanbul', code: 'IST', vol: 'TK 1913', porte: 'D03', terminal: 'Jetée' },
  { heure: '12:10', lieu: 'Rome Fiumicino', court: 'Rome', code: 'FCO', vol: 'AZ 288', porte: 'C12', terminal: 'Principal' },
  { heure: '12:50', lieu: "Nice Côte d'Azur", court: 'Nice', code: 'NCE', vol: 'AF 1316', porte: 'A10', terminal: 'Principal' },
  { heure: '13:30', lieu: 'Copenhague', court: 'Copenhague', code: 'CPH', vol: 'SK 617', porte: 'A08', terminal: 'Principal' },
  { heure: '14:15', lieu: 'Londres Heathrow', court: 'Londres', code: 'LHR', vol: 'LX 349', porte: 'B23', terminal: 'Principal' },
  { heure: '15:00', lieu: 'Dubaï', court: 'Dubaï', code: 'DXB', vol: 'EK 85', porte: 'D02', terminal: 'Jetée' },
  { heure: '15:45', lieu: 'Amsterdam Schiphol', court: 'Amsterdam', code: 'AMS', vol: 'KL 1929', porte: 'B13', terminal: 'Principal' },
  { heure: '16:25', lieu: 'Barcelone El Prat', court: 'Barcelone', code: 'BCN', vol: 'VY 6622', porte: 'C05', terminal: 'Principal' },
  { heure: '17:15', lieu: 'Paris Charles-de-Gaulle', court: 'Paris', code: 'CDG', vol: 'AF 1244', porte: 'A11', terminal: 'Principal' },
  { heure: '18:00', lieu: 'Zurich', court: 'Zurich', code: 'ZRH', vol: 'LX 2804', porte: 'A03', terminal: 'Principal' },
  { heure: '18:45', lieu: 'Lisbonne Humberto Delgado', court: 'Lisbonne', code: 'LIS', vol: 'TP 934', porte: 'D02', terminal: 'Jetée' },
  { heure: '19:30', lieu: 'Londres Heathrow', court: 'Londres', code: 'LHR', vol: 'BA 727', porte: 'B25', terminal: 'Principal' },
  { heure: '20:20', lieu: 'Madrid Barajas', court: 'Madrid', code: 'MAD', vol: 'IB 3510', porte: 'C08', terminal: 'Principal' },
  { heure: '21:15', lieu: 'Francfort', court: 'Francfort', code: 'FRA', vol: 'LH 1210', porte: 'B06', terminal: 'Principal' },
  { heure: '22:00', lieu: 'Zurich', court: 'Zurich', code: 'ZRH', vol: 'LX 2808', porte: 'A04', terminal: 'Principal' },
];
