"""
Seed script: populates the database with ports, terminals, berths,
PIL vessels (full fleet), realistic vessel calls, and default users.
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from database import AsyncSessionLocal, init_db
import models
from auth import get_password_hash

PORTS = [
    # (unlocode, name, country, cc, lat, lon, tz, terminals, quay_m, loa_m, draft_m, tidal_m, density, anchorage)
    ("SGSIN", "Singapore",                  "Singapore",    "SG",  1.264,  103.820, "Asia/Singapore",      6, 20000, 400, 20.0, 0.3, 1.025, 50),
    ("CNSHA", "Shanghai",                   "China",        "CN", 31.200,  121.600, "Asia/Shanghai",       8, 25000, 400, 18.0, 2.5, 1.020, 80),
    ("MYTPP", "Tanjung Pelepas",            "Malaysia",     "MY",  1.363,  103.548, "Asia/Kuala_Lumpur",   2,  4000, 350, 16.5, 2.0, 1.023, 20),
    ("MYPKG", "Port Klang",                 "Malaysia",     "MY",  3.000,  101.369, "Asia/Kuala_Lumpur",   4,  8000, 330, 15.0, 2.5, 1.020, 30),
    ("LKCMB", "Colombo",                    "Sri Lanka",    "LK",  6.950,   79.860, "Asia/Colombo",        3,  5000, 360, 18.0, 0.5, 1.025, 25),
    ("KRPUS", "Busan",                      "South Korea",  "KR", 35.107,  129.044, "Asia/Seoul",          5, 12000, 400, 17.0, 1.2, 1.025, 40),
    ("TWKHH", "Kaohsiung",                  "Taiwan",       "TW", 22.625,  120.300, "Asia/Taipei",         4,  8000, 350, 16.0, 0.8, 1.022, 30),
    ("HKHKG", "Hong Kong",                  "Hong Kong",    "HK", 22.310,  114.172, "Asia/Hong_Kong",      4,  7000, 400, 15.5, 1.0, 1.025, 35),
    ("CNNBO", "Ningbo-Zhoushan",            "China",        "CN", 29.867,  122.100, "Asia/Shanghai",       6, 15000, 400, 20.0, 2.0, 1.020, 60),
    ("CNTAO", "Qingdao",                    "China",        "CN", 36.066,  120.391, "Asia/Shanghai",       4, 10000, 380, 17.5, 2.8, 1.020, 40),
    ("CNTXG", "Tianjin",                    "China",        "CN", 39.000,  117.700, "Asia/Shanghai",       5, 12000, 350, 16.0, 2.5, 1.018, 35),
    ("CNNSA", "Guangzhou (Nansha)",         "China",        "CN", 22.730,  113.547, "Asia/Shanghai",       3,  6000, 360, 17.0, 1.5, 1.018, 20),
    ("AEDXB", "Dubai (Jebel Ali)",          "UAE",          "AE", 25.011,   55.062, "Asia/Dubai",          3,  8000, 400, 17.0, 0.2, 1.025, 25),
    ("SAJED", "Jeddah",                     "Saudi Arabia", "SA", 21.493,   39.173, "Asia/Riyadh",         2,  3500, 320, 15.0, 0.5, 1.027, 20),
    ("EGPSD", "Port Said",                  "Egypt",        "EG", 31.260,   32.310, "Africa/Cairo",        2,  4000, 350, 15.0, 0.3, 1.026, 15),
    ("NLRTM", "Rotterdam",                  "Netherlands",  "NL", 51.911,    4.480, "Europe/Amsterdam",    5, 18000, 400, 24.0, 1.8, 1.025, 40),
    ("DEHAM", "Hamburg",                    "Germany",      "DE", 53.546,    9.970, "Europe/Berlin",       4, 10000, 370, 15.6, 3.2, 1.010, 25),
    ("GBFXT", "Felixstowe",                 "UK",           "GB", 51.962,    1.351, "Europe/London",       3,  5000, 380, 16.0, 3.5, 1.025, 20),
    ("BEANR", "Antwerp",                    "Belgium",      "BE", 51.252,    4.404, "Europe/Brussels",     5, 14000, 400, 15.5, 4.2, 1.015, 30),
    ("USNYC", "New York / New Jersey",      "USA",          "US", 40.670,  -74.100, "America/New_York",    4, 10000, 380, 15.5, 1.5, 1.025, 30),
    ("USLAX", "Los Angeles / Long Beach",   "USA",          "US", 33.748, -118.212, "America/Los_Angeles", 5, 15000, 400, 16.0, 1.4, 1.025, 45),
    ("USHOU", "Houston",                    "USA",          "US", 29.726,  -95.269, "America/Chicago",     3,  6000, 330, 14.0, 0.5, 1.022, 20),
    ("CAHAL", "Halifax",                    "Canada",       "CA", 44.650,  -63.580, "America/Halifax",     2,  2500, 310, 15.5, 1.5, 1.026, 10),
    ("BRSSZ", "Santos",                     "Brazil",       "BR",-23.960,  -46.340, "America/Sao_Paulo",   3,  5000, 300, 13.0, 0.8, 1.023, 15),
    ("ZADUR", "Durban",                     "South Africa", "ZA",-29.870,   31.030, "Africa/Johannesburg", 3,  4500, 320, 14.0, 0.5, 1.025, 20),
    ("KEMBA", "Mombasa",                    "Kenya",        "KE", -4.040,   39.669, "Africa/Nairobi",      2,  2000, 280, 13.0, 3.2, 1.025, 10),
    ("PKPQG", "Karachi (QICT)",             "Pakistan",     "PK", 24.840,   67.020, "Asia/Karachi",        2,  3000, 300, 14.5, 1.0, 1.025, 15),
    ("INMAA", "Chennai",                    "India",        "IN", 13.098,   80.298, "Asia/Kolkata",        3,  4000, 290, 13.0, 0.8, 1.025, 20),
    ("INNSA", "Jawaharlal Nehru Port",      "India",        "IN", 18.950,   72.951, "Asia/Kolkata",        4,  7000, 350, 14.5, 4.0, 1.022, 25),
    ("PHLIM", "Manila",                     "Philippines",  "PH", 14.593,  120.961, "Asia/Manila",         3,  4000, 300, 12.0, 0.8, 1.025, 15),
    ("IDTPP", "Tanjung Priok (Jakarta)",    "Indonesia",    "ID", -6.098,  106.889, "Asia/Jakarta",        4,  7000, 330, 14.0, 0.8, 1.023, 25),
    ("THBKK", "Laem Chabang (Bangkok)",     "Thailand",     "TH", 13.095,  100.882, "Asia/Bangkok",        3,  5000, 330, 14.5, 0.8, 1.022, 20),
    ("VNSGN", "Ho Chi Minh City",           "Vietnam",      "VN", 10.730,  106.724, "Asia/Ho_Chi_Minh",    2,  3000, 280, 11.5, 2.5, 1.020, 10),
    ("MYPGU", "Penang",                     "Malaysia",     "MY",  5.415,  100.348, "Asia/Kuala_Lumpur",   2,  2500, 280, 12.5, 1.8, 1.022, 10),
    ("AUBNE", "Brisbane",                   "Australia",    "AU",-27.384,  153.177, "Australia/Brisbane",  2,  3000, 300, 13.0, 1.7, 1.025, 10),
    ("AUSYD", "Sydney",                     "Australia",    "AU",-33.860,  151.200, "Australia/Sydney",    2,  2500, 280, 13.0, 1.3, 1.025,  8),
    ("NZAKL", "Auckland",                   "New Zealand",  "NZ",-36.840,  174.770, "Pacific/Auckland",    2,  2000, 280, 13.0, 2.5, 1.025,  8),
    ("ILHFA", "Haifa",                      "Israel",       "IL", 32.820,   35.000, "Asia/Jerusalem",      2,  2500, 300, 14.0, 0.3, 1.028, 10),
    ("GRSKG", "Thessaloniki",               "Greece",       "GR", 40.641,   22.936, "Europe/Athens",       2,  2000, 270, 11.5, 0.3, 1.028,  8),
    ("ESBCN", "Barcelona",                  "Spain",        "ES", 41.335,    2.175, "Europe/Madrid",       3,  4000, 340, 16.0, 0.2, 1.027, 15),
]

TERMINAL_TEMPLATES = [
    ("Container Terminal 1", "PSA",             0.40, "independent", None, None, 8, 500000, 3000000),
    ("Container Terminal 2", "Hutchison Ports", 0.35, "shared",      None, None, 6, 400000, 2500000),
    ("General Cargo Terminal","Port Authority",  0.25, "independent", 12.0, 280.0,4, 200000, 1000000),
]

BERTH_TEMPLATES = [
    ("B01", 400, None), ("B02", 350, None), ("B03", 300, 14.0), ("B04", 280, 12.5),
]

# Full PIL fleet
# (mmsi, imo, name, teu, loa_m, flag, gt, dwt)
# MMSIs: fictional but MMSI-format valid (flag-prefix + sequential)
# IMOs: 99xxxxx range (unallocated, for demo use only)
PIL_VESSELS = [
    # ── A ───────────────────────────────────────────────────────
    ("636000001", "9900001", "ASTERIOS",              1827, 185, "LR",  22750,  7789),
    # ── HUDONG 13K series (newbuildings on order) ────────────────
    ("563000001", "9900002", "HUDONG 13K H1933A",    13064, 383, "SG", 131423, None),
    ("563000002", "9900003", "HUDONG 13K H1934A",    13064, 383, "SG", 131423, None),
    ("563000003", "9900004", "HUDONG 13K H1935A",    13064, 383, "SG", 131423, None),
    ("563000004", "9900005", "HUDONG 13K H1936A",    13064, 383, "SG", 131423, None),
    ("563000005", "9900006", "HUDONG 13K H1937A",    13064, 383, "SG", 131423, None),
    # ── K-A ─────────────────────────────────────────────────────
    ("563000006", "9900007", "KOTA ANGGUN",           1454, 175, "SG",  23842,  8156),
    ("563000007", "9900008", "KOTA AZAM",             1454, 175, "SG",  23825,  8156),
    # ── K-C ─────────────────────────────────────────────────────
    ("563000008", "9900009", "KOTA CABAR",            6606, 302, "SG",  89119, 41719),
    ("563000009", "9900010", "KOTA CAHAYA",           6606, 302, "SG",  83963, 41719),
    ("538000001", "9900011", "KOTA CALLAO",           7092, 320, "MH",  73172, 45182),
    ("563000010", "9900012", "KOTA CANTIK",           6606, 302, "SG",  83963, 41723),
    ("563000011", "9900013", "KOTA CARUM",            6606, 302, "SG",  83963, 41735),
    ("563000012", "9900014", "KOTA CEMPAKA",          6606, 302, "SG",  89488, 41703),
    ("563000013", "9900015", "KOTA CEPAT",            6606, 302, "SG",  84331, 41703),
    # ── K-D ─────────────────────────────────────────────────────
    ("563000014", "9900016", "KOTA DAHLIA",            628, 120, "SG",   8164,  2656),
    ("563000015", "9900017", "KOTA DUNIA",             628, 120, "SG",   8214,  2656),
    ("563000016", "9900018", "KOTA DUTA",              628, 120, "SG",   8244,  2656),
    # ── K-E ─────────────────────────────────────────────────────
    ("563000017", "9900019", "KOTA EAGLE",           14450, 400, "SG", 156620, 79406),
    ("563000018", "9900020", "KOTA EBONY",           14450, 400, "SG", 156597, 79406),
    ("563000019", "9900021", "KOTA EMBUN",           14410, 399, "SG", 156517, 79406),
    ("563000020", "9900022", "KOTA EMERALD",         14450, 400, "SG", 156620, 79406),
    # ── K-G ─────────────────────────────────────────────────────
    ("563000021", "9900023", "KOTA GABUNG",           2754, 215, "SG",  39572, 13359),
    ("563000022", "9900024", "KOTA GADANG",           2800, 215, "SG",  39598, 13359),
    ("563000023", "9900025", "KOTA GANDING",          2800, 215, "SG",  39598, 13359),
    ("563000024", "9900026", "KOTA GAYA",             2754, 215, "SG",  39598, 13359),
    # ── K-H ─────────────────────────────────────────────────────
    ("563000025", "9900027", "KOTA HAKIM",            1080, 152, "SG",  18830,  7314),
    ("563000026", "9900028", "KOTA HALUS",            1080, 152, "SG",  18872,  7314),
    ("563000027", "9900029", "KOTA HANDAL",           1080, 152, "SG",  18855,  7314),
    ("563000028", "9900030", "KOTA HAPAS",            1080, 152, "SG",  13491,  7314),
    ("563000029", "9900031", "KOTA HARUM",            1080, 152, "SG",  18870,  7314),
    ("563000030", "9900032", "KOTA HENING",           1080, 152, "SG",  18871,  7314),
    ("563000031", "9900033", "KOTA HIDAYAH",          1170, 158, "SG",  17296,  5823),
    # ── K-J ─────────────────────────────────────────────────────
    ("563000032", "9900034", "KOTA JAYA",             1728, 182, "SG",  24921,  9413),
    ("563000033", "9900035", "KOTA JOHAN",            2034, 192, "SG",  24146,  7279),
    # ── K-K ─────────────────────────────────────────────────────
    ("563000034", "9900036", "KOTA KAMIL",            3081, 228, "SG",  39782, 15648),
    ("563000035", "9900037", "KOTA KARIM",            3081, 228, "SG",  39763, 15648),
    ("563000036", "9900038", "KOTA KAYA",             3081, 228, "SG",  39932, 15648),
    # ── K-L ─────────────────────────────────────────────────────
    ("563000037", "9900039", "KOTA LAMBAI",           4253, 260, "SG",  50595, 24504),
    ("563000038", "9900040", "KOTA LAMBANG",          4253, 260, "SG",  50595, 24504),
    ("563000039", "9900041", "KOTA LARIS",            4253, 260, "SG",  50638, 24504),
    ("563000040", "9900042", "KOTA LAWA",             4253, 260, "SG",  50638, 24504),
    ("563000041", "9900043", "KOTA LAYANG",           4253, 260, "SG",  50594, 24504),
    ("563000042", "9900044", "KOTA LEGIT",            4800, 282, "SG",  57778, 20270),
    ("563000043", "9900045", "KOTA LEKAS",            4800, 282, "SG",  57712, 20270),
    ("563000044", "9900046", "KOTA LEMBAH",           4335, 262, "SG",  51822, 23676),
    ("563000045", "9900047", "KOTA LESTARI",          4335, 262, "SG",  51822, 23676),
    ("563000046", "9900048", "KOTA LIHAT",            4335, 262, "SG",  51768, 23676),
    ("636000002", "9900049", "KOTA LIMA",             5544, 295, "LR",  67197, 27512),
    ("563000047", "9900050", "KOTA LOCENG",           4335, 262, "SG",  51822, 23676),
    ("563000048", "9900051", "KOTA LUMAYAN",          4253, 260, "SG",  50745, 24504),
    ("477000001", "9900052", "KOTA LUMBAH",           4253, 260, "HK",  50603, 24504),
    # ── K-M ─────────────────────────────────────────────────────
    ("563000049", "9900053", "KOTA MACHAN",           3566, 240, "SG",  45361, 13856),
    ("477000002", "9900054", "KOTA MAKMUR",           3566, 240, "HK",  45349, 13856),
    ("563000050", "9900055", "KOTA MANIS",            3566, 240, "SG",  45349, 13856),
    ("636000003", "9900056", "KOTA MANZANILLO",       8533, 335, "LR", 103378, 56693),
    ("563000051", "9900057", "KOTA MEGAH",            3566, 240, "SG",  45349, 13856),
    # ── K-N ─────────────────────────────────────────────────────
    ("563000052", "9900058", "KOTA NABIL",            1810, 185, "SG",  25985,  9119),
    ("563000053", "9900059", "KOTA NAGA",             1810, 185, "SG",  25985,  9121),
    ("563000054", "9900060", "KOTA NALURI",           1810, 185, "SG",  25985,  9111),
    ("563000055", "9900061", "KOTA NANHAI",           1810, 185, "SG",  25985,  9123),
    ("563000056", "9900062", "KOTA NASRAT",           1810, 185, "SG",  25985,  9119),
    ("563000057", "9900063", "KOTA NAZAR",            1810, 185, "SG",  25985,  9112),
    ("563000058", "9900064", "KOTA NAZIM",            1810, 185, "SG",  25985,  9114),
    ("563000059", "9900065", "KOTA NEBULA",           1810, 185, "SG",  25985,  9118),
    ("352000001", "9900066", "KOTA NEKAD",            1810, 185, "PA",  25985,  9123),
    ("563000060", "9900067", "KOTA NILAM",            1810, 185, "SG",  25985,  9118),
    ("563000061", "9900068", "KOTA NIPAH",            1810, 185, "SG",  25943,  9121),
    # ── K-O ─────────────────────────────────────────────────────
    ("563000062", "9900069", "KOTA OASIS",            8350, 335, "SG",  98626, 41812),
    ("563000063", "9900070", "KOTA OCEAN",            8350, 335, "SG",  98626, 41812),
    ("563000064", "9900071", "KOTA ODYSSEY",          8350, 335, "SG",  98112, 41812),
    ("563000065", "9900072", "KOTA ORKID",            8350, 335, "SG",  98080, 41812),
    # ── K-P ─────────────────────────────────────────────────────
    ("563000066", "9900073", "KOTA PAHLAWAN",        11923, 366, "SG", 132646, 62816),
    ("563000067", "9900074", "KOTA PELANGI",         11923, 366, "SG", 132623, 62816),
    ("636000004", "9900075", "KOTA PEONY",           13082, 383, "LR", 141203, 63565),
    ("239000001", "9900076", "KOTA PLUMBAGO",        13082, 383, "GR", 142117, 63565),
    ("636000005", "9900077", "KOTA PRIMROSE",        13082, 383, "LR", 141550, 63565),
    ("477000003", "9900078", "KOTA PURI",            11923, 366, "HK", 132586, 63895),
    ("477000004", "9900079", "KOTA PUSAKA",          11923, 366, "HK", 132586, 63895),
    # ── K-R ─────────────────────────────────────────────────────
    ("563000068", "9900080", "KOTA RAHMAT",            907, 145, "SG",  12985,  4512),
    ("563000069", "9900081", "KOTA RAJA",              777, 138, "SG",  13060,  4537),
    ("563000070", "9900082", "KOTA RAJIN",             938, 145, "SG",  13212,  4558),
    ("563000071", "9900083", "KOTA RAKAN",             907, 145, "SG",  12997,  4512),
    ("563000072", "9900084", "KOTA RAKYAT",            907, 145, "SG",  13001,  4512),
    ("563000073", "9900085", "KOTA RANCAK",            943, 145, "SG",  13260,  4558),
    ("563000074", "9900086", "KOTA RATNA",             777, 138, "SG",  13055,  4537),
    ("563000075", "9900087", "KOTA RATU",              777, 138, "SG",  13064,  4537),
    ("563000076", "9900088", "KOTA RESTU",             943, 145, "SG",  13194,  4558),
    ("563000077", "9900089", "KOTA RIA",               907, 145, "SG",  13017,  4512),
    ("563000078", "9900090", "KOTA RUKUN",             777, 138, "SG",  13058,  4537),
    # ── K-S ─────────────────────────────────────────────────────
    ("563000079", "9900091", "KOTA SABAS",            3889, 252, "SG",  51739, 22321),
    ("563000080", "9900092", "KOTA SAHABAT",          3889, 252, "SG",  51739, 22321),
    ("563000081", "9900093", "KOTA SALAM",            3889, 252, "SG",  51739, 22321),
    ("636000006", "9900094", "KOTA SANTOS",           8463, 335, "LR", 106936, 59328),
    ("563000082", "9900095", "KOTA SATRIA",           3889, 252, "SG",  51755, 22321),
    ("563000083", "9900096", "KOTA SEGAR",            3889, 252, "SG",  51739, 22321),
    ("563000084", "9900097", "KOTA SEJARAH",          3889, 252, "SG",  51755, 22321),
    ("563000085", "9900098", "KOTA SEJATI",           3889, 252, "SG",  51755, 22321),
    ("563000086", "9900099", "KOTA SELAMAT",          3889, 252, "SG",  51755, 22321),
    ("563000087", "9900100", "KOTA SEMPENA",          3889, 252, "SG",  51755, 22321),
    ("563000088", "9900101", "KOTA SETIA",            3889, 252, "SG",  51755, 22321),
    ("563000089", "9900102", "KOTA SINGA",            3889, 252, "SG",  51783, 22321),
    ("563000090", "9900103", "KOTA SURIA",            3889, 252, "SG",  51790, 22321),
    # ── K-T/V ───────────────────────────────────────────────────
    ("563000091", "9900104", "KOTA SYDNEY",           7092, 320, "SG",  84900, 45182),
    ("563000092", "9900105", "KOTA TEMA",             7092, 320, "SG",  86799, 45182),
    ("563000093", "9900106", "KOTA TENAGA",            728, 130, "SG",  10700,  4145),
    ("538000002", "9900107", "KOTA VALPARAISO",       7092, 320, "MH",  86793, 45182),
    # ── Others ──────────────────────────────────────────────────
    ("636000007", "9900108", "LITTLE MERMAID",        1781, 182, "LR",  24468,  8093),
    ("533000001", "9900109", "SALAM MAJU",            1170, 158, "MY",  17324,  5823),
    ("525000001", "9900110", "SELATAN DAMAI",          628, 120, "ID",   8150,  2656),
    ("413000001", "9900111", "ZHONG HANG SHENG",      2783, 215, "CN",  35600, 12626),
]

# PIL service port rotations
PIL_SERVICES = {
    "AEX1": ["SGSIN", "MYTPP", "LKCMB", "AEDXB", "SAJED", "EGPSD", "NLRTM", "DEHAM", "GBFXT", "BEANR"],
    "AEX2": ["SGSIN", "MYPKG", "INNSA", "INMAA", "AEDXB", "NLRTM", "DEHAM", "BEANR", "GBFXT"],
    "PSW":  ["SGSIN", "CNSHA", "CNNBO", "KRPUS", "USLAX", "USNYC"],
    "IAX":  ["SGSIN", "MYTPP", "THBKK", "VNSGN", "PHLIM", "IDTPP"],
    "OCE":  ["SGSIN", "MYPGU", "AUBNE", "AUSYD", "NZAKL"],
    "IPX":  ["SGSIN", "LKCMB", "PKPQG", "INNSA", "INMAA", "MYPKG"],
}

# Service assignment by TEU size
_SERVICE_BY_TEU = [
    (11000, ["AEX1", "AEX2"]),
    (7000,  ["AEX1", "AEX2", "PSW"]),
    (4000,  ["PSW", "OCE", "IPX"]),
    (2000,  ["IAX", "IPX", "OCE"]),
    (0,     ["IAX"]),
]


def _service_for(teu: int, idx: int) -> str:
    for threshold, choices in _SERVICE_BY_TEU:
        if teu >= threshold:
            return choices[idx % len(choices)]
    return "IAX"


async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select, func
        port_count = (await db.execute(select(func.count(models.Port.id)))).scalar()
        if port_count == 0:
            await _seed_ports(db)

    await _seed_vessel_calls()


async def _seed_ports(db):
    print("Seeding ports, terminals, berths, and users...")
    for (unlocode, name, country, cc, lat, lon, tz,
         n_terminals, quay_m, loa_m, draft_m, tidal_m, density, anc) in PORTS:

        port = models.Port(
            unlocode=unlocode, name=name, country=country, country_code=cc,
            latitude=lat, longitude=lon, timezone=tz, num_terminals=n_terminals,
            quay_length_m=quay_m, max_vessel_loa_m=loa_m, max_draft_m=draft_m,
            tidal_range_m=tidal_m, water_density=density, anchorage_capacity=anc,
            vessels_waiting=random.randint(0, 6),
            vessels_at_berth=random.randint(1, min(n_terminals * 3, 15)),
            berth_utilization_pct=random.uniform(30, 85),
            yard_utilization_pct=random.uniform(40, 90),
            avg_waiting_hours=random.uniform(0, 36),
        )
        if port.vessels_waiting >= 5 or port.berth_utilization_pct >= 85:
            port.congestion_level = models.CongestionLevel.high
        elif port.vessels_waiting >= 3 or port.berth_utilization_pct >= 65:
            port.congestion_level = models.CongestionLevel.medium
        else:
            port.congestion_level = models.CongestionLevel.low
        db.add(port)
        await db.flush()

        for i in range(min(n_terminals, 3)):
            tmpl = TERMINAL_TEMPLATES[i % len(TERMINAL_TEMPLATES)]
            terminal = models.Terminal(
                port_id=port.id, name=f"{name} {tmpl[0]}", operator=tmpl[1],
                total_quay_length_m=(quay_m or 4000) * tmpl[2],
                berth_configuration=(models.BerthConfig.shared if tmpl[3] == "shared" else models.BerthConfig.independent),
                max_draft_m=tmpl[4] or draft_m, max_vessel_loa_m=tmpl[5] or loa_m,
                crane_count=tmpl[6], yard_capacity_teu=tmpl[7], annual_capacity_teu=tmpl[8],
                yard_utilization_pct=random.uniform(40, 90),
                berth_utilization_pct=random.uniform(30, 85),
            )
            db.add(terminal)
            await db.flush()
            for bnum, blen, bdraft in BERTH_TEMPLATES:
                db.add(models.Berth(
                    terminal_id=terminal.id, berth_number=bnum, name=f"Berth {bnum}",
                    length_m=blen, max_draft_m=bdraft or draft_m, max_loa_m=blen, is_active=True,
                ))

        for cat, title, content, source in [
            ("approach",     "Pilotage",        "Compulsory pilotage for vessels over 50m LOA. VHF Ch 16/12.", "Port Authority"),
            ("operational",  "Working Hours",   "24/7 operations. Pre-arrival notice 48h required.",          "Terminal Ops"),
            ("environmental","Emissions Control","Vessels must use low sulfur fuel within port limits.",        "Environmental"),
        ]:
            db.add(models.PortSupplementaryInfo(port_id=port.id, category=cat, title=title, content=content, source=source))

    db.add(models.User(email="admin@tmm.local",    full_name="TMM Administrator",
                       hashed_password=get_password_hash("Admin@2024!"), role=models.UserRole.admin))
    db.add(models.User(email="operator@tmm.local", full_name="Ops User",
                       hashed_password=get_password_hash("Operator@2024!"), role=models.UserRole.operator))
    await db.commit()
    print(f"Seeded {len(PORTS)} ports with terminals, berths, and users.")


async def _seed_vessel_calls():
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select, func, delete

        # Check if full fleet already seeded (KOTA EAGLE is a new-generation vessel)
        has_new_fleet = (await db.execute(
            select(func.count(models.Vessel.mmsi)).where(models.Vessel.name == "KOTA EAGLE")
        )).scalar() > 0

        if has_new_fleet:
            return

        # Remove old placeholder vessels and their calls so we can re-seed
        old_mmsis_q = select(models.Vessel.mmsi).where(models.Vessel.is_pil_vessel == True)
        await db.execute(delete(models.VesselCall).where(models.VesselCall.mmsi.in_(old_mmsis_q)))
        await db.execute(delete(models.Vessel).where(models.Vessel.is_pil_vessel == True))
        await db.commit()

        print(f"Seeding {len(PIL_VESSELS)} PIL vessels with voyage calls...")
        now = datetime.now(timezone.utc)
        port_map = {p.unlocode: p for p in (await db.execute(select(models.Port))).scalars().all()}

        # Seed all PIL vessels
        vessels = []
        for idx, (mmsi, imo, name, teu, loa, flag, gt, dwt) in enumerate(PIL_VESSELS):
            svc = _service_for(teu, idx)
            v = models.Vessel(
                mmsi=mmsi, imo=imo, name=name, vessel_type="Container Ship",
                flag=flag, operator="Pacific International Lines",
                loa_m=loa, teu_capacity=teu, gt=gt, dwt=dwt,
                is_pil_vessel=True, service=svc,
            )
            db.add(v)
            vessels.append((v, svc))

        await db.flush()

        # Generate voyage calls for each vessel
        for idx, (vessel, service) in enumerate(vessels):
            port_rotation = PIL_SERVICES[service]
            voyage_num = f"PIL{service}{now.strftime('%y%m')}{idx + 1:03d}"
            voyage_start = now - timedelta(days=(idx % 20) * 3)

            for port_idx, unlocode in enumerate(port_rotation):
                port = port_map.get(unlocode)
                if not port:
                    continue
                terminal = (await db.execute(
                    select(models.Terminal).where(models.Terminal.port_id == port.id)
                )).scalars().first()

                proforma_eta = voyage_start + timedelta(days=port_idx * 3)
                proforma_etb = proforma_eta + timedelta(hours=random.uniform(2, 8))
                proforma_etd = proforma_etb + timedelta(hours=random.uniform(18, 36))
                delay_h = random.choice([0, 0, 0, 0, 4, 8, 12, 24])
                eta = proforma_eta + timedelta(hours=delay_h)
                etb = proforma_etb + timedelta(hours=delay_h * 0.8)
                etd = proforma_etd + timedelta(hours=delay_h * 0.5)

                if etd < now:       status = models.VesselStatus.underway
                elif etb < now:     status = models.VesselStatus.at_berth
                elif eta < now:     status = models.VesselStatus.waiting
                else:               status = models.VesselStatus.underway

                db.add(models.VesselCall(
                    mmsi=vessel.mmsi, port_id=port.id,
                    terminal_id=terminal.id if terminal else None,
                    voyage_number=voyage_num,
                    proforma_eta=proforma_eta, proforma_etb=proforma_etb, proforma_etd=proforma_etd,
                    proforma_moves=random.randint(200, 1200),
                    eta=eta, etb=etb, etd=etd,
                    actual_moves=random.randint(150, 1100) if status == models.VesselStatus.at_berth else None,
                    status=status,
                    delay_reason="Weather delay" if delay_h >= 12 else None,
                ))

        await db.commit()
        print(f"Seeded {len(PIL_VESSELS)} PIL vessels with voyage calls.")


if __name__ == "__main__":
    asyncio.run(seed())
