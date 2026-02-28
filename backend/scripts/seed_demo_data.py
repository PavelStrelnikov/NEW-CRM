#!/usr/bin/env python3
"""
Demo data seeder for CRM database.

IMPORTANT: This script is for development/demo purposes only.
Do NOT run in production environments.

Usage:
    python backend/scripts/seed_demo_data.py --reset --seed 123

Args:
    --count-clients: Number of client companies (default: 80)
    --max-branches-per-client: Max sites per client (default: 4)
    --max-contacts-per-branch: Max contacts per site (default: 6)
    --count-assets: Total number of assets (default: 350)
    --count-tickets: Total number of tickets (default: 500)
    --seed: Random seed for reproducibility (default: 123)
    --reset: Drop all data before seeding (CAREFUL!)
"""

import sys
import os
import argparse
import random
from datetime import datetime, timedelta, date
from decimal import Decimal
from pathlib import Path
from typing import List, Dict, Any

# Add backend directory to Python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from faker import Faker
from sqlalchemy import text
from sqlalchemy.orm import Session

# Import database session
from app.db.session import SessionLocal, engine

# Import all models
from app.models.users import InternalUser, ClientUser, InternalUserRole, ClientUserRole, Locale
from app.models.clients import Client, Site, Contact, Location, ClientStatus
from app.models.tickets import (
    TicketStatusDefinition, Ticket, TicketInitiator, TicketEvent,
    TicketCategory, TicketPriority, SourceChannel, ReportedVia, ServiceScope, InitiatorType
)
from app.models.time_billing import WorkLog, TicketLineItem, WorkType, ItemType
from app.models.assets import (
    AssetType, Asset, AssetPropertyDefinition, AssetPropertyValue,
    AssetEvent, NVRDisk, AssetStatus, PropertyDataType
)
from app.models.attachments import Attachment, LinkedType

# Import password hashing - use bcrypt directly for Python 3.14+ compatibility
# passlib has compatibility issues with newer bcrypt versions
import bcrypt


class DemoDataSeeder:
    """Demo data seeder with realistic IT company data."""

    def __init__(self, seed: int = 123):
        """Initialize seeder with given random seed."""
        self.seed = seed
        random.seed(seed)
        self.fake = Faker(['he_IL', 'en_US'])
        Faker.seed(seed)

        # Storage for created objects
        self.internal_users: List[InternalUser] = []
        self.clients: List[Client] = []
        self.sites: List[Site] = []
        self.contacts: List[Contact] = []
        self.locations: List[Location] = []
        self.assets: List[Asset] = []
        self.asset_types: List[AssetType] = []
        self.tickets: List[Ticket] = []
        self.ticket_statuses: List[TicketStatusDefinition] = []

        # Hebrew and English company types
        self.company_types_he = [
            'בע"מ', 'בע"מ', 'בע"מ', 'בע"מ', '(חל"צ)', 'ושות\'',
        ]

        # Common IT equipment manufacturers
        self.manufacturers = {
            'NVR': ['Hikvision', 'Dahua', 'Uniview', 'Hanwha Techwin', 'Axis'],
            'DVR': ['Hikvision', 'Dahua', 'Uniview', 'Hanwha Techwin'],
            'IP_CAMERA': ['Hikvision', 'Dahua', 'Uniview', 'Hanwha Techwin', 'Axis'],
            'ROUTER': ['Check Point', 'Mikrotik', 'Cisco', 'Ubiquiti', 'FortiGate'],
            'SWITCH': ['Aruba', 'HP', 'Cisco', 'Ubiquiti', 'Mikrotik', 'TP-Link'],
            'ACCESS_POINT': ['Aruba', 'Ruijie', 'Ubiquiti', 'TP-Link', 'Ruckus'],
            'SERVER': ['Dell', 'HP', 'Lenovo', 'Supermicro'],
            'PC': ['Dell', 'HP', 'Lenovo'],
            'PRINTER': ['HP', 'Canon', 'Brother', 'Epson'],
            'ALARM': ['Paradox', 'DSC', 'Visonic', 'RISCO'],
            'INTERCOM': ['Akuvox', 'Hikvision', 'Dahua', '2N'],
            'UPS': ['APC', 'CyberPower', 'Eaton'],
            'NAS': ['Synology', 'QNAP'],
        }

        # Ticket issue templates
        self.ticket_templates = {
            TicketCategory.CCTV: [
                ('מצלמה לא עובדת', 'Camera {num} not working at {location}'),
                ('אין תמונה ב-NVR', 'No video feed from NVR'),
                ('הקלטה לא עובדת', 'Recording stopped on channel {num}'),
                ('צריך להוסיף מצלמה', 'Need to install new camera at {location}'),
                ('תקלה בדיסק', 'Disk failure warning on NVR'),
                ('איכות תמונה ירודה', 'Poor image quality from camera {num}'),
                ('צריך להזיז מצלמה', 'Need to relocate camera at {location}'),
            ],
            TicketCategory.NETWORK: [
                ('אין אינטרנט', 'No internet connection'),
                ('רשת איטית', 'Network very slow'),
                ('נתק חוזר', 'Intermittent disconnections'),
                ('צריך נקודת רשת חדשה', 'Need new network point at {location}'),
                ('WiFi לא עובד', 'WiFi not working in {location}'),
                ('תקלה בסוויץ\'', 'Switch malfunction'),
                ('בעיה בנתב', 'Router issue'),
            ],
            TicketCategory.PC: [
                ('מחשב לא עולה', 'Computer won\'t boot'),
                ('מחשב איטי מאוד', 'Computer extremely slow'),
                ('בעיה עם מדפסת', 'Printer not working'),
                ('צריך התקנה', 'Need software installation'),
                ('נגיף/תוכנה זדונית', 'Virus/malware suspected'),
                ('צריך מחשב חדש', 'Need new computer'),
            ],
            TicketCategory.ALARM: [
                ('אזעקה לא עובדת', 'Alarm system not working'),
                ('חיישן פתוח', 'Sensor showing open'),
                ('צריך לתכנת שלט', 'Need to program new remote'),
                ('בטריה חלשה', 'Low battery warning'),
                ('אזעקת שווא', 'False alarm issue'),
            ],
            TicketCategory.OTHER: [
                ('בקשה כללית', 'General request'),
                ('שאלה טכנית', 'Technical question'),
                ('צריך ייעוץ', 'Need consultation'),
                ('בדיקה תקופתית', 'Periodic maintenance'),
            ],
        }

    def reset_database(self, db: Session):
        """
        DANGEROUS: Reset all data tables (keeps seed data and admin user).

        Strategy: TRUNCATE parent tables with CASCADE
        --------------------------------------------
        - PostgreSQL TRUNCATE CASCADE automatically handles all dependent tables
        - RESTART IDENTITY resets auto-increment sequences
        - Future-proof: new FK relationships are automatically handled by CASCADE
        - No ForeignKeyViolation errors since CASCADE follows FK constraints

        Preserves:
        - ticket_status_definitions (seed data)
        - asset_types and asset_property_definitions (seed data)
        - internet_providers (seed data)
        - admin user in internal_users
        """
        print("\n⚠️  WARNING: Resetting database tables...")

        try:
            # TRUNCATE parent tables with CASCADE - this is the key to avoiding FK violations
            # CASCADE automatically deletes all dependent rows in related tables
            # Order doesn't matter because CASCADE handles dependencies
            parent_tables = [
                'clients',      # Cascades to: sites, contacts, client_users, assets, tickets, projects
                'projects',     # Cascades to: project_events, project_ticket_links, project_asset_links, project_site_links
            ]

            for table in parent_tables:
                try:
                    # TRUNCATE is faster than DELETE and automatically handles FK constraints
                    # RESTART IDENTITY resets sequences (like auto-increment IDs)
                    # CASCADE deletes dependent rows in all related tables
                    db.execute(text(f'TRUNCATE TABLE {table} RESTART IDENTITY CASCADE'))
                    print(f"   ✓ Truncated {table} (CASCADE cleared all dependent tables)")
                except Exception as e:
                    # Table might not exist in older schema versions - that's OK
                    print(f"   ⚠ Could not truncate {table}: {e}")

            # Special case: internal_users (preserve admin@example.com)
            # Must use DELETE (not TRUNCATE) to selectively keep specific rows
            result = db.execute(text("DELETE FROM internal_users WHERE email != 'admin@example.com'"))
            deleted_count = result.rowcount
            print(f"   ✓ Deleted {deleted_count} internal users (kept admin)")

            # Commit the transaction
            db.commit()
            print("✅ Database reset complete\n")

        except Exception as e:
            # Rollback on any error to maintain DB consistency
            db.rollback()
            print(f"\n❌ ERROR during database reset: {e}")
            import traceback
            traceback.print_exc()
            raise

    def create_internal_users(self, db: Session, count: int = 10):
        """Create internal staff users."""
        print(f"Creating {count} internal users...")

        users = []

        # Create a mix of roles
        roles_distribution = [
            (InternalUserRole.ADMIN, 2),
            (InternalUserRole.TECHNICIAN, 6),
            (InternalUserRole.OFFICE, 2),
        ]

        user_count = 0
        for role, role_count in roles_distribution:
            for i in range(role_count):
                if user_count >= count:
                    break

                name = self.fake.name()
                email = f"{name.lower().replace(' ', '.')}@company.local"

                # Hash password using bcrypt directly (Python 3.14+ compatible)
                password_bytes = 'password123'.encode('utf-8')
                hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
                password_hash = hashed.decode('utf-8')

                user = InternalUser(
                    name=name,
                    email=email,
                    phone=self.fake.phone_number()[:20],
                    password_hash=password_hash,
                    role=role,
                    preferred_locale=random.choice([Locale.HE_IL, Locale.EN_US]),
                    is_active=True,
                )
                users.append(user)
                user_count += 1

        db.bulk_save_objects(users)
        db.commit()

        # Reload with IDs
        self.internal_users = db.query(InternalUser).all()
        print(f"✅ Created {len(users)} internal users")

    def create_clients(self, db: Session, count: int = 80):
        """Create client companies."""
        print(f"Creating {count} clients...")

        clients = []
        for _ in range(count):
            # Mix of Hebrew and English company names
            if random.random() < 0.7:  # 70% Hebrew names
                company_name = self.fake.company()
                company_suffix = random.choice(self.company_types_he)
                name = f"{company_name} {company_suffix}"
            else:
                name = self.fake.company()

            client = Client(
                name=name,
                main_address=self.fake.address(),
                notes=self.fake.text(max_nb_chars=200) if random.random() < 0.3 else None,
                status=random.choices(
                    [ClientStatus.ACTIVE, ClientStatus.INACTIVE],
                    weights=[0.9, 0.1]
                )[0],
            )
            clients.append(client)

        db.bulk_save_objects(clients)
        db.commit()

        # Reload with IDs
        self.clients = db.query(Client).all()
        print(f"✅ Created {len(clients)} clients")

    def create_sites_and_locations(self, db: Session, max_sites_per_client: int = 4):
        """Create sites (branches) for clients and locations within sites."""
        print(f"Creating sites (max {max_sites_per_client} per client)...")

        sites = []
        locations = []

        for client in self.clients:
            num_sites = random.randint(1, max_sites_per_client)

            for i in range(num_sites):
                site = Site(
                    client_id=client.id,
                    name=f"סניף {self.fake.city()}" if random.random() < 0.7 else f"Branch {i+1}",
                    address=self.fake.address(),
                    is_default=(i == 0),  # First site is default
                    notes=self.fake.text(max_nb_chars=150) if random.random() < 0.2 else None,
                )
                sites.append(site)

        db.bulk_save_objects(sites)
        db.commit()

        # Reload sites with IDs
        self.sites = db.query(Site).all()

        # Create locations for each site
        for site in self.sites:
            num_locations = random.randint(2, 8)

            for floor_num in range(num_locations):
                location = Location(
                    site_id=site.id,
                    building='A' if random.random() < 0.8 else random.choice(['B', 'C']),
                    floor=str(floor_num) if floor_num > 0 else 'קרקע',
                    room=f"{random.randint(100, 599)}" if random.random() < 0.7 else None,
                    description=random.choice([
                        'משרד', 'מחסן', 'חדר שרת', 'קבלה', 'חדר ישיבות',
                        'Office', 'Warehouse', 'Server room', 'Reception', 'Meeting room'
                    ]) if random.random() < 0.5 else None,
                )
                locations.append(location)

        db.bulk_save_objects(locations)
        db.commit()

        # Reload locations with IDs
        self.locations = db.query(Location).all()

        print(f"✅ Created {len(self.sites)} sites and {len(self.locations)} locations")

    def create_contacts(self, db: Session, max_contacts_per_client: int = 6):
        """Create contacts for clients."""
        print(f"Creating contacts (max {max_contacts_per_client} per client)...")

        contacts = []

        for client in self.clients:
            num_contacts = random.randint(1, max_contacts_per_client)
            client_sites = [s for s in self.sites if s.client_id == client.id]

            for _ in range(num_contacts):
                name = self.fake.name()
                applies_to_all = random.random() < 0.3  # 30% apply to all sites

                contact = Contact(
                    client_id=client.id,
                    name=name,
                    phone=self.fake.phone_number()[:20],
                    email=f"{name.lower().replace(' ', '.')}@{client.name.lower().replace(' ', '')}.com"[:50],
                    position=random.choice([
                        'מנהל', 'מנהל IT', 'טכנאי', 'מנהל תפעול',
                        'Manager', 'IT Manager', 'Technician', 'Operations Manager'
                    ]),
                    notes=self.fake.text(max_nb_chars=100) if random.random() < 0.1 else None,
                    applies_to_all_sites=applies_to_all,
                )
                contacts.append(contact)

        db.bulk_save_objects(contacts)
        db.commit()

        # Reload contacts with IDs
        self.contacts = db.query(Contact).all()

        # Link contacts to specific sites (if not applies_to_all_sites)
        for contact in self.contacts:
            if not contact.applies_to_all_sites:
                client_sites = [s for s in self.sites if s.client_id == contact.client_id]
                # Link to 1-3 random sites
                num_sites = min(random.randint(1, 3), len(client_sites))
                linked_sites = random.sample(client_sites, num_sites)
                contact.sites.extend(linked_sites)

        db.commit()

        print(f"✅ Created {len(contacts)} contacts")

    def create_assets(self, db: Session, total_count: int = 350):
        """Create diverse IT assets."""
        print(f"Creating {total_count} assets...")

        # Get asset types
        self.asset_types = db.query(AssetType).all()
        asset_types_by_code = {at.code: at for at in self.asset_types}

        assets = []
        asset_property_values = []
        nvr_disks = []

        # Distribute assets across clients proportionally
        active_clients = [c for c in self.clients if c.status == ClientStatus.ACTIVE]

        for _ in range(total_count):
            client = random.choice(active_clients)
            client_sites = [s for s in self.sites if s.client_id == client.id]
            site = random.choice(client_sites)
            site_locations = [l for l in self.locations if l.site_id == site.id]
            location = random.choice(site_locations) if site_locations else None

            # Choose asset type with realistic distribution
            asset_type_weights = {
                'IP_CAMERA': 40,
                'NVR': 5,
                'DVR': 3,
                'SWITCH': 10,
                'ROUTER': 5,
                'ACCESS_POINT': 15,
                'PC': 10,
                'SERVER': 2,
                'PRINTER': 5,
                'ALARM': 3,
                'UPS': 2,
            }

            asset_type_code = random.choices(
                list(asset_type_weights.keys()),
                weights=list(asset_type_weights.values())
            )[0]

            if asset_type_code not in asset_types_by_code:
                asset_type_code = 'OTHER'

            asset_type = asset_types_by_code[asset_type_code]
            manufacturer = random.choice(self.manufacturers.get(asset_type_code, ['Generic']))

            # Generate realistic model numbers
            model = f"{manufacturer}-{random.randint(1000, 9999)}"
            if asset_type_code in ['IP_CAMERA', 'NVR', 'DVR']:
                model += random.choice(['-T', '-S', '-P', '-I', ''])

            install_date = self.fake.date_between(start_date='-5y', end_date='today')

            asset = Asset(
                client_id=client.id,
                site_id=site.id,
                asset_type_id=asset_type.id,
                label=f"{asset_type_code}-{random.randint(1, 999):03d}",
                manufacturer=manufacturer,
                model=model,
                serial_number=f"SN{random.randint(100000, 999999)}" if random.random() < 0.8 else None,
                install_date=install_date,
                status=random.choices(
                    [AssetStatus.ACTIVE, AssetStatus.IN_REPAIR, AssetStatus.REPLACED, AssetStatus.RETIRED],
                    weights=[0.85, 0.05, 0.05, 0.05]
                )[0],
                location_id=location.id if location else None,
                notes=self.fake.text(max_nb_chars=200) if random.random() < 0.2 else None,
            )
            assets.append(asset)

            # Add NVR disks for NVR/DVR
            if asset_type_code in ['NVR', 'DVR']:
                # Will add after asset has ID
                asset._nvr_disk_count = random.randint(1, 4)

        db.bulk_save_objects(assets)
        db.commit()

        # Reload assets with IDs
        self.assets = db.query(Asset).all()

        # Create NVR disks for NVRs/DVRs
        for asset in self.assets:
            if hasattr(asset, '_nvr_disk_count'):
                for slot in range(asset._nvr_disk_count):
                    disk = NVRDisk(
                        asset_id=asset.id,
                        slot_number=slot + 1,
                        capacity_tb=Decimal(random.choice(['1.0', '2.0', '4.0', '6.0', '8.0'])),
                        install_date=asset.install_date or date.today(),
                        serial_number=f"HDD{random.randint(100000, 999999)}",
                    )
                    nvr_disks.append(disk)

        if nvr_disks:
            db.bulk_save_objects(nvr_disks)
            db.commit()

        print(f"✅ Created {len(assets)} assets and {len(nvr_disks)} NVR disks")

    def create_tickets(self, db: Session, count: int = 500):
        """Create realistic support tickets."""
        print(f"Creating {count} tickets...")

        # Get ticket statuses
        self.ticket_statuses = db.query(TicketStatusDefinition).all()
        status_weights = {
            'NEW': 15,
            'IN_PROGRESS': 30,
            'WAITING_CUSTOMER': 10,
            'RESOLVED': 25,
            'CLOSED': 20,
        }

        tickets = []
        initiators = []
        events = []
        work_logs = []
        line_items = []

        # Get technicians for assignment
        technicians = [u for u in self.internal_users if u.role == InternalUserRole.TECHNICIAN]
        office_users = [u for u in self.internal_users if u.role == InternalUserRole.OFFICE]
        all_internal = technicians + office_users

        # Date range: last 180 days
        start_date = datetime.now() - timedelta(days=180)

        for i in range(count):
            # Pick a random client and site
            client = random.choice([c for c in self.clients if c.status == ClientStatus.ACTIVE])
            client_sites = [s for s in self.sites if s.client_id == client.id]
            site = random.choice(client_sites)

            # Pick contact
            client_contacts = [c for c in self.contacts if c.client_id == client.id]
            contact = random.choice(client_contacts) if client_contacts else None

            # Category and issue
            category = random.choice(list(TicketCategory))
            templates = self.ticket_templates.get(category, self.ticket_templates[TicketCategory.OTHER])
            title_he, title_en = random.choice(templates)

            # Randomize title
            title = title_he if random.random() < 0.7 else title_en
            title = title.format(
                num=random.randint(1, 20),
                location=random.choice(['קומה 2', 'משרד ראשי', 'מחסן', 'Floor 2', 'Main office'])
            )

            # Description
            description = self.fake.text(max_nb_chars=300)

            # Status
            status_code = random.choices(
                list(status_weights.keys()),
                weights=list(status_weights.values())
            )[0]
            status = next((s for s in self.ticket_statuses if s.code == status_code), self.ticket_statuses[0])

            # Created at (spread over last 180 days)
            created_at = start_date + timedelta(
                days=random.randint(0, 180),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )

            # Assignment
            assigned_to = random.choice(technicians) if random.random() < 0.7 else None

            ticket = Ticket(
                ticket_number=f"TKT-{2024000 + i + 1}",
                client_id=client.id,
                site_id=site.id,
                title=title,
                description=description,
                category=category.value,
                priority=random.choices(
                    [p.value for p in TicketPriority],
                    weights=[20, 50, 20, 10]
                )[0],
                source_channel=random.choice([s.value for s in SourceChannel]),
                reported_via=random.choice([r.value for r in ReportedVia]),
                status_id=status.id,
                assigned_to_internal_user_id=assigned_to.id if assigned_to else None,
                service_scope=random.choices(
                    [s.value for s in ServiceScope],
                    weights=[40, 40, 20]
                )[0],
                contact_person_id=contact.id if contact else None,
                contact_name=contact.name if contact else self.fake.name(),
                contact_phone=contact.phone if contact else self.fake.phone_number()[:20],
                contact_email=contact.email if contact and random.random() < 0.5 else None,
                closed_at=created_at + timedelta(days=random.randint(1, 14)) if status.is_closed_state else None,
                created_at=created_at,
                updated_at=created_at,
            )
            tickets.append(ticket)

            # Initiator (who opened the ticket)
            initiator_type = random.choices(
                [InitiatorType.INTERNAL_USER, InitiatorType.CLIENT_USER, InitiatorType.EXTERNAL_IDENTITY],
                weights=[20, 60, 20]
            )[0]

            if initiator_type == InitiatorType.INTERNAL_USER:
                initiator_user = random.choice(all_internal)
                initiator = TicketInitiator(
                    ticket_id=ticket.id,  # Will be set after commit
                    initiator_type=initiator_type.value,
                    initiator_ref_id=initiator_user.id,
                    initiator_display=initiator_user.name,
                )
            else:
                initiator = TicketInitiator(
                    ticket_id=ticket.id,
                    initiator_type=initiator_type.value,
                    initiator_ref_id=None,
                    initiator_display=contact.name if contact else self.fake.name(),
                )
            initiators.append((ticket, initiator))

        # Save tickets first
        db.bulk_save_objects(tickets)
        db.commit()

        # Reload tickets with IDs
        self.tickets = db.query(Ticket).order_by(Ticket.created_at).all()

        # Create initiators with correct ticket IDs
        for i, (ticket, initiator_template) in enumerate(initiators):
            actual_ticket = self.tickets[i]
            initiator = TicketInitiator(
                ticket_id=actual_ticket.id,
                initiator_type=initiator_template.initiator_type,
                initiator_ref_id=initiator_template.initiator_ref_id,
                initiator_display=initiator_template.initiator_display,
            )
            db.add(initiator)

        db.commit()

        # Create events, work logs, and line items for tickets
        for ticket in self.tickets:
            # Events (comments, status changes)
            num_events = random.randint(1, 5)
            event_time = ticket.created_at

            for _ in range(num_events):
                event_time += timedelta(hours=random.randint(1, 48))

                actor_user = random.choice(all_internal)
                event = TicketEvent(
                    ticket_id=ticket.id,
                    event_type=random.choice(['comment', 'status_change', 'assignment_change']),
                    message=self.fake.text(max_nb_chars=150),
                    actor_type='internal_user',
                    actor_id=actor_user.id,
                    actor_display=actor_user.name,
                    created_at=event_time,
                )
                events.append(event)

            # Work logs (if ticket is in progress or closed)
            if ticket.status_id != self.ticket_statuses[0].id:  # Not NEW
                num_work_logs = random.randint(1, 4)

                for _ in range(num_work_logs):
                    technician = random.choice(technicians)
                    duration = random.randint(15, 240)  # 15 minutes to 4 hours

                    work_log = WorkLog(
                        ticket_id=ticket.id,
                        work_type=random.choice([w.value for w in WorkType]),
                        description=self.fake.text(max_nb_chars=200),
                        start_at=ticket.created_at + timedelta(hours=random.randint(1, 72)),
                        end_at=None,
                        duration_minutes=duration,
                        included_in_service=random.random() < 0.6,  # 60% included
                        actor_type='internal_user',
                        actor_id=technician.id,
                        actor_display=technician.name,
                        created_at=ticket.created_at + timedelta(hours=random.randint(1, 72)),
                    )
                    work_logs.append(work_log)

            # Line items (materials, equipment)
            if random.random() < 0.4:  # 40% of tickets have line items
                num_items = random.randint(1, 3)

                for _ in range(num_items):
                    technician = random.choice(technicians)

                    line_item = TicketLineItem(
                        ticket_id=ticket.id,
                        item_type=random.choice([i.value for i in ItemType]),
                        description=random.choice([
                            'כבל רשת CAT6 - 10 מטר',
                            'מצלמת IP 4MP',
                            'נקודת גישה WiFi',
                            'Network cable CAT6 - 10m',
                            'IP Camera 4MP',
                            'WiFi access point',
                        ]),
                        quantity=Decimal(random.randint(1, 10)),
                        unit=random.choice(['יחידה', 'מטר', 'Unit', 'Meter']),
                        included_in_service=random.random() < 0.3,
                        chargeable=random.random() < 0.7,
                        actor_type='internal_user',
                        actor_id=technician.id,
                        actor_display=technician.name,
                        created_at=ticket.created_at + timedelta(hours=random.randint(1, 72)),
                    )
                    line_items.append(line_item)

        # Bulk save all related objects
        if events:
            db.bulk_save_objects(events)
        if work_logs:
            db.bulk_save_objects(work_logs)
        if line_items:
            db.bulk_save_objects(line_items)

        db.commit()

        print(f"✅ Created {len(tickets)} tickets with {len(events)} events, {len(work_logs)} work logs, and {len(line_items)} line items")

    def print_summary(self):
        """Print summary of created data."""
        print("\n" + "="*60)
        print("SEED DATA SUMMARY")
        print("="*60)
        print(f"Internal Users:  {len(self.internal_users)}")
        print(f"Clients:         {len(self.clients)}")
        print(f"Sites:           {len(self.sites)}")
        print(f"Locations:       {len(self.locations)}")
        print(f"Contacts:        {len(self.contacts)}")
        print(f"Assets:          {len(self.assets)}")
        print(f"Tickets:         {len(self.tickets)}")
        print("="*60)
        print("\n✅ Demo data seeding completed successfully!")
        print("\nYou can now:")
        print("  - Start the backend: uvicorn app.main:app --reload")
        print("  - Login as admin: admin@example.com / change_me_now")
        print("  - Or as any internal user: password123")
        print()


def main():
    """Main entry point."""
    # Load environment variables from .env file
    from dotenv import load_dotenv

    # Try to load .env from backend directory (where the script is run from)
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"📄 Loaded environment from: {env_path}")
    else:
        # Try current directory
        load_dotenv()
        print("📄 Loaded environment from current directory .env")

    parser = argparse.ArgumentParser(
        description='Seed demo data for CRM database (DEV ONLY!)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument('--count-clients', type=int, default=80,
                       help='Number of client companies (default: 80)')
    parser.add_argument('--max-branches-per-client', type=int, default=4,
                       help='Max sites per client (default: 4)')
    parser.add_argument('--max-contacts-per-branch', type=int, default=6,
                       help='Max contacts per client (default: 6)')
    parser.add_argument('--count-assets', type=int, default=350,
                       help='Total number of assets (default: 350)')
    parser.add_argument('--count-tickets', type=int, default=500,
                       help='Total number of tickets (default: 500)')
    parser.add_argument('--seed', type=int, default=123,
                       help='Random seed for reproducibility (default: 123)')
    parser.add_argument('--reset', action='store_true',
                       help='DANGEROUS: Reset all data before seeding')

    args = parser.parse_args()

    # Safety check: prevent running in production
    db_url = os.getenv('DATABASE_URL', '')
    if 'localhost' not in db_url and '127.0.0.1' not in db_url:
        print("❌ ERROR: This script can only run on localhost databases!")
        print(f"   Current DATABASE_URL: {db_url}")
        print("   Refusing to run to prevent data loss.")
        sys.exit(1)

    print("\n" + "="*60)
    print("CRM DEMO DATA SEEDER")
    print("="*60)
    print(f"Random Seed:     {args.seed}")
    print(f"Clients:         {args.count_clients}")
    print(f"Max Sites/Client: {args.max_branches_per_client}")
    print(f"Max Contacts:    {args.max_contacts_per_branch}")
    print(f"Assets:          {args.count_assets}")
    print(f"Tickets:         {args.count_tickets}")
    print(f"Reset Database:  {args.reset}")
    print("="*60)

    if args.reset:
        confirm = input("\n⚠️  Are you SURE you want to reset the database? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Aborted.")
            sys.exit(0)

    # Create seeder
    seeder = DemoDataSeeder(seed=args.seed)

    # Get database session
    db = SessionLocal()

    try:
        # Reset if requested
        if args.reset:
            seeder.reset_database(db)

        # Create data
        seeder.create_internal_users(db, count=10)
        seeder.create_clients(db, count=args.count_clients)
        seeder.create_sites_and_locations(db, max_sites_per_client=args.max_branches_per_client)
        seeder.create_contacts(db, max_contacts_per_client=args.max_contacts_per_branch)
        seeder.create_assets(db, total_count=args.count_assets)
        seeder.create_tickets(db, count=args.count_tickets)

        # Print summary
        seeder.print_summary()

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == '__main__':
    main()
