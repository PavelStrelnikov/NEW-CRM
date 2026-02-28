import requests
import json

# Login
response = requests.post('http://localhost:8000/api/v1/auth/login', json={
    'email': 'admin@example.com',
    'password': 'change_me_now'
})
token = response.json()['access_token']
print(f'Got token: {token[:20]}...')

# Get first client
headers = {'Authorization': f'Bearer {token}'}
clients_response = requests.get('http://localhost:8000/api/v1/clients', headers=headers)
clients = clients_response.json()['items']
if not clients:
    print('No clients found')
    exit(1)
client = clients[0]
print(f'Using client: {client["name"]} (ID: {client["id"]})')

# Get first site for this client
sites_response = requests.get(f'http://localhost:8000/api/v1/clients/{client["id"]}/sites', headers=headers)
sites = sites_response.json()
if not sites:
    print('No sites found')
    exit(1)
site = sites[0]
print(f'Using site: {site["name"]} (ID: {site["id"]})')

# Get or create a contact for this client
contacts_response = requests.get(f'http://localhost:8000/api/v1/clients/{client["id"]}/contacts', headers=headers)
contacts = contacts_response.json()
if contacts:
    contact = contacts[0]
    print(f'Using contact: {contact.get("name", "N/A")} (ID: {contact["id"]})')
    contact_id = contact['id']
else:
    print('No contacts found, creating one...')
    contact_data = {
        'name': 'Test Contact',
        'role': 'user',
        'phone': '050-1234567',
        'email': 'test@example.com',
        'is_active': True
    }
    contact_response = requests.post(f'http://localhost:8000/api/v1/clients/{client["id"]}/contacts', headers=headers, json=contact_data)
    if contact_response.status_code == 201:
        contact = contact_response.json()
        contact_id = contact['id']
        print(f'Created contact: {contact.get("name", "N/A")} (ID: {contact_id})')
    else:
        print(f'Failed to create contact: {contact_response.status_code} - {contact_response.text}')
        exit(1)

# Create ticket
ticket_data = {
    'client_id': client['id'],
    'site_id': site['id'],
    'title': 'Test ticket creation',
    'description': 'Testing ticket creation after fix',
    'source_channel': 'phone',
    'reported_via': 'phone',
    'contact_phone': '050-1234567',
    'contact_name': 'Test Contact',
    'contact_person_id': contact_id,
    'initiator_type': 'internal_user',
    'initiator_ref_id': None,
    'initiator_display': 'Admin User',
    'service_scope': 'included'
}

print('Creating ticket...')
response = requests.post('http://localhost:8000/api/v1/tickets', headers=headers, json=ticket_data)
print(f'Status: {response.status_code}')
print(f'Response: {response.text}')
