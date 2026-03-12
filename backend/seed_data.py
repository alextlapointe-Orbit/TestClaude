"""
Seed script: populates the database with major global container ports,
terminals, berths, and a default admin user.

Run with: python seed_data.py
"""

import asyncio
from database import AsyncSessionLocal, init_db
import models
from auth import get_password_hash

PORTS = [
    # (unlocode, name, country, cc, lat, lon, tz, terminals, quay_m, loa_m, draft_m, tidal_m, density, anchorage)
    ("SGSIN", "Singapore", "Singapore", "SG", 1.264, 103.820, "Asia/Singapore", 6, 20000, 400, 20.0, 0.3, 1.025, 50),
    ("CNSHA", "Shanghai", "China", "CN", 31.200, 121.600, "Asia/Shanghai", 8, 25000, 400, 18.0, 2.5, 1.020, 80),
    ("MYTPP", "Tanjung Pelepas", "Malaysia", "MY", 1.363, 103.548, "Asia/Kuala_Lumpur", 2, 4000, 350, 16.5, 2.0, 1.023, 20),
    ("MYPKG", "Port Klang", "Malaysia", "MY", 3.000, 101.369, "Asia/Kuala_Lumpur", 4, 8000, 330, 15.0, 2.5, 1.020, 30),
    ("LKCMB", "Colombo", "Sri Lanka", "LK", 6.950, 79.860, "Asia/Colombo", 3, 5000, 360, 18.0, 0.5, 1.025, 25),
    ("KRPUS", "Busan", "South Korea", "KR", 35.107, 129.044, "Asia/Seoul", 5, 12000, 400, 17.0, 1.2, 1.025, 40),
    ("TWKHH", "Kaohsiung", "Taiwan", "TW", 22.625, 120.300, "Asia/Taipei", 4, 8000, 350, 16.0, 0.8, 1.022, 30),
    ("HKHKG", "Hong Kong", "Hong Kong", "HK", 22.310, 114.172, "Asia/Hong_Kong", 4, 7000, 400, 15.5, 1.0, 1.025, 35),
    ("CNNBO", "Ningbo-Zhoushan", "China", "CN", 29.867, 122.100, "Asia/Shanghai", 6, 15000, 400, 20.0, 2.0, 1.020, 60),
    ("CNTAO", "Qingdao", "China", "CN", 36.066, 120.391, "Asia/Shanghai", 4, 10000, 380, 17.5, 2.8, 1.020, 40),
    ("CNTXG", "Tianjin", "China", "CN", 39.000, 117.700, "Asia/Shanghai", 5, 12000, 350, 16.0, 2.5, 1.018, 35),
    ("CNNSA", "Guangzhou (Nansha)", "China", "CN", 22.730, 113.547, "Asia/Shanghai", 3, 6000, 360, 17.0, 1.5, 1.018, 20),
    ("AEDXB", "Dubai (Jebel Ali)", "UAE", "AE", 25.011, 55.062, "Asia/Dubai", 3, 8000, 400, 17.0, 0.2, 1.025, 25),
    ("SAJED", "Jeddah", "Saudi Arabia", "SA", 21.493, 39.173, "Asia/Riyadh", 2, 3500, 320, 15.0, 0.5, 1.027, 20),
    ("EGPSD", "Port Said", "Egypt", "EG", 31.260, 32.310, "Africa/Cairo", 2, 4000, 350, 15.0, 0.3, 1.026, 15),
    ("NLRTM", "Rotterdam", "Netherlands", "NL", 51.911, 4.480, "Europe/Amsterdam", 5, 18000, 400, 24.0, 1.8, 1.025, 40),
    ("DEHAM", "Hamburg", "Germany", "DE", 53.546, 9.970, "Europe/Berlin", 4, 10000, 370, 15.6, 3.2, 1.010, 25),
    ("GBFXT", "Felixstowe", "United Kingdom", "GB", 51.962, 1.351, "Europe/London", 3, 5000, 380, 16.0, 3.5, 1.025, 20),
    ("BEANR", "Antwerp", "Belgium", "BE", 51.252, 4.404, "Europe/Brussels", 5, 14000, 400, 15.5, 4.2, 1.015, 30),
    ("USNYC", "New York / New Jersey", "USA", "US", 40.670, -74.100, "America/New_York", 4, 10000, 380, 15.5, 1.5, 1.025, 30),
    ("USLAX", "Los Angeles / Long Beach", "USA", "US", 33.748, -118.212, "America/Los_Angeles", 5, 15000, 400, 16.0, 1.4, 1.025, 45),
    ("USHOU", "Houston", "USA", "US", 29.726, -95.269, "America/Chicago", 3, 6000, 330, 14.0, 0.5, 1.022, 20),
    ("CAHAL", "Halifax", "Canada", "CA", 44.650, -63.580, "America/Halifax", 2, 2500, 310, 15.5, 1.5, 1.026, 10),
    ("BRSSZ", "Santos", "Brazil", "BR", -23.960, -46.340, "America/Sao_Paulo", 3, 5000, 300, 13.0, 0.8, 1.023, 15),
    ("ZADUR", "Durban", "South Africa", "ZA", -29.870, 31.030, "Africa/Johannesburg", 3, 4500, 320, 14.0, 0.5, 1.025, 20),
    ("KEMBA", "Mombasa", "Kenya", "KE", -4.040, 39.669, "Africa/Nairobi", 2, 2000, 280, 13.0, 3.2, 1.025, 10),
    ("PKPQG", "Karachi (QICT)", "Pakistan", "PK", 24.840, 67.020, "Asia/Karachi", 2, 3000, 300, 14.5, 1.0, 1.025, 15),
    ("INMAA", "Chennai", "India", "IN", 13.098, 80.298, "Asia/Kolkata", 3, 4000, 290, 13.0, 0.8, 1.025, 20),
    ("INNSA", "Jawaharlal Nehru Port (JNPT)", "India", "IN", 18.950, 72.951, "Asia/Kolkata", 4, 7000, 350, 14.5, 4.0, 1.022, 25),
    ("PHLIM", "Manila", "Philippines", "PH", 14.593, 120.961, "Asia/Manila", 3, 4000, 300, 12.0, 0.8, 1.025, 15),
    ("IDTPP", "Tanjung Priok (Jakarta)", "Indonesia", "ID", -6.098, 106.889, "Asia/Jakarta", 4, 7000, 330, 14.0, 0.8, 1.023, 25),
    ("THBKK", "Laem Chabang (Bangkok)", "Thailand", "TH", 13.095, 100.882, "Asia/Bangkok", 3, 5000, 330, 14.5, 0.8, 1.022, 20),
    ("VNSGN", "Ho Chi Minh City (Cat Lai)", "Vietnam", "VN", 10.730, 106.724, "Asia/Ho_Chi_Minh", 2, 3000, 280, 11.5, 2.5, 1.020, 10),
    ("MYPGU", "Penang", "Malaysia", "MY", 5.415, 100.348, "Asia/Kuala_Lumpur", 2, 2500, 280, 12.5, 1.8, 1.022, 10),
    ("AUBNE", "Brisbane", "Australia", "AU", -27.384, 153.177, "Australia/Brisbane", 2, 3000, 300, 13.0, 1.7, 1.025, 10),
    ("AUSYD", "Sydney", "Australia", "AU", -33.860, 151.200, "Australia/Sydney", 2, 2500, 280, 13.0, 1.3, 1.025, 8),
    ("NZAKL", "Auckland", "New Zealand", "NZ", -36.840, 174.770, "Pacific/Auckland", 2, 2000, 280, 13.0, 2.5, 1.025, 8),
    ("ILHFA", "Haifa", "Israel", "IL", 32.820, 35.000, "Asia/Jerusalem", 2, 2500, 300, 14.0, 0.3, 1.028, 10),
    ("GRSKG", "Thessaloniki", "Greece", "GR", 40.641, 22.936, "Europe/Athens", 2, 2000, 270, 11.5, 0.3, 1.028, 8),
    ("ESBCN", "Barcelona", "Spain", "ES", 41.335, 2.175, "Europe/Madrid", 3, 4000, 340, 16.0, 0.2, 1.027, 15),
]

TERMINAL_TEMPLATES = [
    # (name_suffix, operator_suffix, quay_frac, config, max_draft, loa, cranes, teu_cap, annual)
    ("Container Terminal 1", "PSA", 0.4, "independent", None, None, 8, 500000, 3000000),
    ("Container Terminal 2", "Hutchison Ports", 0.35, "shared", None, None, 6, 400000, 2500000),
    ("General Cargo Terminal", "Port Authority", 0.25, "independent", 12.0, 280.0, 4, 200000, 1000000),
]

BERTH_TEMPLATES = [
    # (berth_number, length_m, max_draft_m)
    ("B01", 400, None),
    ("B02", 350, None),
    ("B03", 300, 14.0),
    ("B04", 280, 12.5),
]


async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        from sqlalchemy import select, func
        count_result = await db.execute(select(func.count(models.Port.id)))
        if count_result.scalar() > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding ports, terminals, and berths...")

        for (unlocode, name, country, cc, lat, lon, tz,
             n_terminals, quay_m, loa_m, draft_m, tidal_m, density, anc) in PORTS:

            port = models.Port(
                unlocode=unlocode,
                name=name,
                country=country,
                country_code=cc,
                latitude=lat,
                longitude=lon,
                timezone=tz,
                num_terminals=n_terminals,
                quay_length_m=quay_m,
                max_vessel_loa_m=loa_m,
                max_draft_m=draft_m,
                tidal_range_m=tidal_m,
                water_density=density,
                anchorage_capacity=anc,
                # Randomize some initial congestion data
                vessels_waiting=__import__('random').randint(0, 6),
                vessels_at_berth=__import__('random').randint(1, min(n_terminals * 3, 15)),
                berth_utilization_pct=__import__('random').uniform(30, 85),
                yard_utilization_pct=__import__('random').uniform(40, 90),
                avg_waiting_hours=__import__('random').uniform(0, 36),
            )
            # Set congestion level based on waiting
            import random
            if port.vessels_waiting >= 5 or port.berth_utilization_pct >= 85:
                port.congestion_level = models.CongestionLevel.high
            elif port.vessels_waiting >= 3 or port.berth_utilization_pct >= 65:
                port.congestion_level = models.CongestionLevel.medium
            else:
                port.congestion_level = models.CongestionLevel.low

            db.add(port)
            await db.flush()

            # Create terminals
            n_terms = min(n_terminals, 3)
            for i in range(n_terms):
                tmpl = TERMINAL_TEMPLATES[i % len(TERMINAL_TEMPLATES)]
                t_quay = (quay_m or 4000) * tmpl[2]
                terminal = models.Terminal(
                    port_id=port.id,
                    name=f"{name} {tmpl[0]}",
                    operator=tmpl[1],
                    total_quay_length_m=t_quay,
                    berth_configuration=(
                        models.BerthConfig.shared if tmpl[3] == "shared"
                        else models.BerthConfig.independent
                    ),
                    max_draft_m=tmpl[4] or draft_m,
                    max_vessel_loa_m=tmpl[5] or loa_m,
                    crane_count=tmpl[6],
                    yard_capacity_teu=tmpl[7],
                    annual_capacity_teu=tmpl[8],
                    yard_utilization_pct=random.uniform(40, 90),
                    berth_utilization_pct=random.uniform(30, 85),
                )
                db.add(terminal)
                await db.flush()

                # Create berths
                for j, (bnum, blen, bdraft) in enumerate(BERTH_TEMPLATES):
                    berth = models.Berth(
                        terminal_id=terminal.id,
                        berth_number=f"{bnum}",
                        name=f"Berth {bnum}",
                        length_m=blen,
                        max_draft_m=bdraft or draft_m,
                        max_loa_m=blen,
                        is_active=True,
                    )
                    db.add(berth)

            # Add sample supplementary info
            sample_infos = [
                ("approach", "Pilotage", f"Compulsory pilotage for vessels over 50m LOA. VHF Ch 16/12.", "Port Authority"),
                ("operational", "Working Hours", "24/7 operations. Pre-arrival notice 48h required.", "Terminal Ops"),
                ("environmental", "Emissions Control", "Vessels must use low sulfur fuel within port limits.", "Environmental"),
            ]
            for cat, title, content, source in sample_infos:
                info = models.PortSupplementaryInfo(
                    port_id=port.id,
                    category=cat,
                    title=title,
                    content=content,
                    source=source,
                )
                db.add(info)

        # Create admin user
        admin = models.User(
            email="admin@tmm.local",
            full_name="TMM Administrator",
            hashed_password=get_password_hash("Admin@2024!"),
            role=models.UserRole.admin,
        )
        db.add(admin)

        # Create operator user
        operator = models.User(
            email="operator@tmm.local",
            full_name="Ops User",
            hashed_password=get_password_hash("Operator@2024!"),
            role=models.UserRole.operator,
        )
        db.add(operator)

        await db.commit()
        print(f"Seeded {len(PORTS)} ports with terminals, berths, and supplementary info.")
        print("Default users created:")
        print("  Admin:    admin@tmm.local / Admin@2024!")
        print("  Operator: operator@tmm.local / Operator@2024!")


if __name__ == "__main__":
    asyncio.run(seed())
