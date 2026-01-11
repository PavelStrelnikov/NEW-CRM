# Asset Specification — v1.3

## Core Principles
- System must support ANY equipment type (known or future).
- Asset fields are dynamic via property definitions.
- Secrets are encrypted and access-controlled.
- All changes are audited.

---

## Built-in Asset Types (seed)
- NVR
- DVR
- ROUTER
- SWITCH
- ACCESS_POINT
- PC
- SERVER
- PRINTER
- ALARM
- OTHER

Admin can add custom types at any time.

---

## NVR / DVR Required Properties
- max_camera_channels (enum: 4,8,16,32,64,128,256)
- lan_ip_address
- lan_http_port
- lan_service_port
- wan_public_ip
- wan_http_port
- wan_service_port
- device_username
- device_password (secret)
- camera_count_connected (optional)
- poe_supported (bool)
- poe_port_count (optional)

---

## Router Properties
- provider (FIBER_PROVIDER (enum))
- wan_ip_type (static, dynamic)
- wan_public_ip (if static)
- ddns_name (optional)
- admin_username
- admin_password (secret)

### Dialer Credentials
- dialer_type (pppoe, l2tp, pptp, dhcp, static)
- internet_username (secret)
- internet_password (secret)

---

## Switch Properties
- total_ports
- poe_supported
- poe_port_count
- uplink_port_count (optional)
- management_ip (optional)
- is_managed (bool)

---

## Access Point Properties
- management_type (standalone, controller, cloud)
- controller_name (optional)
- management_ip (optional)
- admin_username
- admin_password (secret)

---

## Custom Asset Types
Admin can define:
- arbitrary properties
- any data type
- bilingual labels (he/en)

Examples:
- PC: OS, RAM, CPU, IP
- Printer: IP, admin password, counter
- Server: OS, RAID, Hypervisor
