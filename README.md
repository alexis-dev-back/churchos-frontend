# ChurchOS Frontend

Interface Angular 18 de ChurchOS. La documentation complète du produit est à la racine du dépôt : [README.md](../README.md) et le dossier [docs/](../docs/).

## Run locally

1. Install Node.js 20+ and npm.
2. From this folder:
   ```bash
   npm install
   npm start
   ```
3. Open http://localhost:4200

## Current status

- Dashboard ChurchOS implemented with the layout and mock data matching the reference.
- Routing placeholders are prepared for the other SaaS modules.
- The app is ready to be connected to the Django REST API.

## Backend conversion flow for a Person to Member

Before converting a person into a member, the authenticated user must select an active organization.

1. Login as owner/admin:
   ```http
   POST /api/auth/login/
   {
     "username": "owner1",
     "password": "password@123"
   }
   ```
2. Select a tenant:
   ```http
   POST /api/auth/select-organization/
   Authorization: Bearer <access_token>
   {
     "tenant_id": "<tenant_uuid>"
   }
   ```
   Or without `tenant_id` if only one organization is available.
3. Create a person:
   ```http
   POST /api/persons/
   Authorization: Bearer <access_token>
   {
     "first_name": "Marie",
     "last_name": "Kouassi",
     "email": "marie@example.com",
     "phone": "+22501020304"
   }
   ```
4. Convert person to member:
   ```http
   POST /api/persons/<person_uuid>/create-membership/
   Authorization: Bearer <access_token>
   {
     "church": "<church_uuid>",
     "campus": "<campus_uuid>",
     "marital_status": "single",
     "address": "Abidjan, Côte d'Ivoire",
     "gender": "F"
   }
   ```

Important: if `tenant_id` is missing in the JWT token, the backend returns `Aucune organisation active n’a été sélectionnée` and the conversion fails.
