# Seed Data — v1.1 (MVP)
Target DB: PostgreSQL
Purpose:
- Provide consistent starting data for statuses, asset types, providers, and baseline asset property definitions.
- Include Hebrew/English labels where helpful.
- Reflect real ISP landscape in Israel.

---

## 1) Ticket Status Definitions (seed)

Seed these rows into `ticket_status_definitions`:

1) NEW
- code: NEW
- name_en: New
- name_he: חדש
- is_default: true
- is_closed_state: false
- is_active: true
- sort_order: 10

2) IN_PROGRESS
- code: IN_PROGRESS
- name_en: In Progress
- name_he: בטיפול
- is_default: false
- is_closed_state: false
- is_active: true
- sort_order: 20

3) WAITING_CUSTOMER
- code: WAITING_CUSTOMER
- name_en: Waiting for Customer
- name_he: ממתין ללקוח
- is_default: false
- is_closed_state: false
- is_active: true
- sort_order: 30

4) RESOLVED
- code: RESOLVED
- name_en: Resolved
- name_he: נפתר
- is_default: false
- is_closed_state: false
- is_active: true
- sort_order: 40

5) CLOSED
- code: CLOSED
- name_en: Closed
- name_he: סגור
- is_default: false
- is_closed_state: true
- is_active: true
- sort_order: 50

Notes:
- Statuses are admin-manageable later.
- `is_closed_state=true` controls ticket closing logic.

---

## 2) Asset Types (seed)

Seed into `asset_types`:

Core (must exist):
- NVR          | name_en: NVR | name_he: מקליט רשת (NVR)
- DVR          | name_en: DVR | name_he: מקליט DVR
- ROUTER       | name_en: Router | name_he: ראוטר
- SWITCH       | name_en: Switch | name_he: סוויץ׳
- ACCESS_POINT | name_en: Access Point | name_he: נקודת גישה (Wi-Fi)

Recommended generic types:
- PC           | name_en: PC | name_he: מחשב
- SERVER       | name_en: Server | name_he: שרת
- PRINTER      | name_en: Printer | name_he: מדפסת
- ALARM        | name_en: Alarm System | name_he: מערכת אזעקה
- OTHER        | name_en: Other | name_he: אחר

Notes:
- Admin may add custom asset types later (CUSTOM_*).
- Asset behavior is driven by property definitions, not hardcoded logic.

---

## 3) Internet Providers (seed) — Israel

Seed into `internet_providers`:

- Bezeq
  - country: IL
  - name_he: בזק

- HOT
  - country: IL
  - name_he: HOT

- Partner
  - country: IL
  - name_he: פרטנר

- Cellcom
  - country: IL
  - name_he: סלקום

- Other
  - country: IL
  - name_he: אחר

Notes:
- Provider list reflects real ISP options in Israel.
- `Other` covers edge cases and resellers.
- List is fixed for MVP (no admin CRUD needed initially).

---

## 4) Baseline Asset Property Definitions (seed)

Property definitions are dynamic and bilingual.
Visibility levels:
- internal_only
- client_admin
- client_all

Data types:
- string, int, bool, date, enum, decimal, secret

---

## 4.1 NVR / DVR property definitions

Applies to asset types: NVR, DVR

### Capacity
1) max_camera_channels
- label_en: Max Camera Channels
- label_he: מספר ערוצים מקסימלי
- data_type: enum
- required: true
- visibility: client_admin
- validation: allowed_values [4,8,16,32,64,128,256]

2) camera_count_connected
- label_en: Cameras Connected
- label_he: מצלמות מחוברות
- data_type: int
- required: false
- visibility: client_admin
- validation: min 0, max 512

### LAN Access
3) lan_ip_address
- label_en: LAN IP Address
- label_he: כתובת IP פנימית
- data_type: string
- required: false
- visibility: client_admin
- validation: ip_v4

4) lan_http_port
- label_en: LAN Web Port
- label_he: פורט Web פנימי
- data_type: int
- required: false
- visibility: client_admin
- validation: min 1, max 65535

5) lan_service_port
- label_en: LAN Service Port
- label_he: פורט שירות פנימי
- data_type: int
- required: false
- visibility: client_admin
- validation: min 1, max 65535

### WAN Access (critical)
6) wan_public_ip
- label_en: WAN Public IP
- label_he: כתובת IP חיצונית
- data_type: string
- required: false
- visibility: internal_only
- validation: ip_v4_or_hostname

7) wan_http_port
- label_en: WAN Web Port
- label_he: פורט Web חיצוני
- data_type: int
- required: false
- visibility: internal_only
- validation: min 1, max 65535

8) wan_service_port
- label_en: WAN Service Port
- label_he: פורט שירות חיצוני
- data_type: int
- required: false
- visibility: internal_only
- validation: min 1, max 65535

### Device Credentials
9) device_username
- label_en: Device Username
- label_he: שם משתמש למכשיר
- data_type: string
- required: false
- visibility: internal_only

10) device_password
- label_en: Device Password
- label_he: סיסמה למכשיר
- data_type: secret
- required: false
- visibility: internal_only

### PoE (optional)
11) poe_supported
- label_en: PoE Supported
- label_he: תומך PoE
- data_type: bool
- required: false
- visibility: client_admin

12) poe_port_count
- label_en: PoE Port Count
- label_he: מספר פורטי PoE
- data_type: int
- required: false
- visibility: client_admin
- validation: min 0, max 64

---

## 4.2 ROUTER property definitions

### Provider & WAN
1) provider_name
- label_en: Internet Provider
- label_he: ספק אינטרנט
- data_type: enum
- required: false
- visibility: internal_only
- validation: allowed_values [Bezeq,HOT,Partner,Cellcom,Other]

2) wan_ip_type
- label_en: WAN IP Type
- label_he: סוג IP חיצוני
- data_type: enum
- required: false
- visibility: internal_only
- validation: allowed_values [static,dynamic]

3) wan_public_ip
- label_en: WAN Public IP
- label_he: כתובת IP חיצונית
- data_type: string
- required: false
- visibility: internal_only
- validation: ip_v4_or_hostname

4) ddns_name
- label_en: DDNS Name
- label_he: כתובת DDNS
- data_type: string
- required: false
- visibility: internal_only

### Router Admin
5) admin_username
- label_en: Router Admin Username
- label_he: שם משתמש ראוטר
- data_type: string
- required: false
- visibility: internal_only

6) admin_password
- label_en: Router Admin Password
- label_he: סיסמת ראוטר
- data_type: secret
- required: false
- visibility: internal_only

### Dialer Credentials
7) dialer_type
- label_en: Dialer Type
- label_he: סוג חייגן
- data_type: enum
- required: false
- visibility: internal_only
- validation: allowed_values [pppoe,l2tp,pptp,dhcp,static]

8) internet_username
- label_en: Internet Username
- label_he: שם משתמש לחייגן
- data_type: secret
- required: false
- visibility: internal_only

9) internet_password
- label_en: Internet Password
- label_he: סיסמת חייגן
- data_type: secret
- required: false
- visibility: internal_only

---

## 4.3 SWITCH property definitions

1) is_managed
- label_en: Managed Switch
- label_he: סוויץ׳ מנוהל
- data_type: bool
- required: false
- visibility: client_admin

2) management_ip
- label_en: Management IP
- label_he: כתובת ניהול
- data_type: string
- required: false
- visibility: internal_only
- validation: ip_v4

3) total_ports
- label_en: Total Ports
- label_he: מספר פורטים כולל
- data_type: int
- required: false
- visibility: client_admin
- validation: min 1, max 128

4) poe_supported
- label_en: PoE Supported
- label_he: תומך PoE
- data_type: bool
- required: false
- visibility: client_admin

5) poe_port_count
- label_en: PoE Port Count
- label_he: מספר פורטי PoE
- data_type: int
- required: false
- visibility: client_admin
- validation: min 0, max 128

6) uplink_port_count
- label_en: Uplink Port Count
- label_he: מספר פורטי Uplink
- data_type: int
- required: false
- visibility: client_admin
- validation: min 0, max 16

7) poe_standard
- label_en: PoE Standard
- label_he: תקן PoE
- data_type: enum
- required: false
- visibility: client_admin
- validation: allowed_values [802.3af,802.3at,802.3bt]

---

## 4.4 ACCESS_POINT property definitions

1) management_type
- label_en: Management Type
- label_he: סוג ניהול
- data_type: enum
- required: false
- visibility: client_admin
- validation: allowed_values [standalone,controller,cloud]

2) controller_name
- label_en: Controller / Cloud Name
- label_he: שם Controller / ענן
- data_type: string
- required: false
- visibility: client_admin

3) management_ip
- label_en: Management IP
- label_he: כתובת ניהול
- data_type: string
- required: false
- visibility: internal_only
- validation: ip_v4

4) admin_username
- label_en: AP Admin Username
- label_he: שם משתמש לניהול
- data_type: string
- required: false
- visibility: internal_only

5) admin_password
- label_en: AP Admin Password
- label_he: סיסמת ניהול
- data_type: secret
- required: false
- visibility: internal_only

6) wifi_ssid_primary
- label_en: Primary SSID
- label_he: שם רשת (SSID) ראשי
- data_type: string
- required: false
- visibility: client_admin

7) wifi_password_primary
- label_en: Primary Wi-Fi Password
- label_he: סיסמת Wi-Fi
- data_type: secret
- required: false
- visibility: internal_only

---

## 5) Validation Notes
- IP validation via standard IP/DNS checks.
- Ports must be 1–65535.
- Enum validation enforced at API layer.

---

## 6) Optional Seed Admin User
- email: admin@example.com
- password: change_me_now
- role: admin
- preferred_locale: he-IL
- is_active: true

Security:
- Force password change on first login in production.
