# VESTRA — Agent Instructions

## Project purpose

VESTRA is a UK-focused fashion e-commerce application being developed as a dissertation software artefact.

Its differentiating features are:

1. Virtual Try-On
2. ML-based Size Recommendation
3. Product Recommendations
4. Standard fashion e-commerce functionality
5. Customer account functionality
6. Administrative catalogue/order/user management

The application is currently in the FRONTEND-FIRST development phase.

---

## Architecture

Project root:

- frontend/ — implemented React frontend
- backend/ — reserved for future Node.js/Express/MongoDB backend

Do NOT implement backend functionality unless explicitly requested.

The future architecture will be:

React frontend
→ Node.js / Express REST API
→ MongoDB

Additional services later:

Express backend
→ Python ML Size Recommendation service

Express backend
→ External Virtual Try-On provider

The browser must never expose private VTO or ML provider API keys.

---

## Frontend stack

Use the existing stack and architecture.

Current frontend uses:

- React
- Vite
- TypeScript
- Tailwind CSS
- Shadcn UI
- React Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Axios
- Lucide React
- Sonner

Do not replace these technologies without explicit instruction.

Do not add:

- Next.js
- Supabase
- Firebase
- Bolt Database
- Redux
- server-side rendering

Do not install new dependencies unless genuinely necessary.

Prefer existing Shadcn components and current utilities.

---

## Layout architecture

The project deliberately separates customer and admin layouts.

StorefrontLayout owns customer-facing global UI such as:

- AnnouncementBar
- Header
- Search
- Cart drawer
- Mobile navigation
- Storefront footer

AdminLayout is independent.

Never put these inside admin pages:

- storefront announcement bar
- Women/Men/New In navigation
- customer wishlist/bag navigation
- storefront footer
- newsletter
- customer-service footer links

Admin pages must use AdminLayout only.

Do not reverse this architecture.

---

## Authentication architecture

Authentication is currently frontend mock authentication.

Existing route guards differentiate:

- unauthenticated users
- customers
- admins

Do not implement real authentication yet.

Preserve demo customer/admin functionality unless explicitly asked otherwise.

---

## Mock product architecture

During frontend development, product data is mock-driven.

Admin catalogue changes and storefront catalogue reads must use the same shared mock product data/repository.

Do not create a second unrelated product data source.

Admin product management currently supports functionality including:

- Add Product
- Edit Product
- Delete Product
- Duplicate Product
- Publish / Unpublish
- Bulk actions
- CSV Import
- Categories
- Inventory

Preserve this functionality.

Changes made through admin mock catalogue management should be reflected in the storefront.

---

## API architecture

Page components should not directly contain API implementation logic.

Keep network/mock access inside service modules.

The frontend must remain ready to switch from mock services to future Express API calls.

Environment concepts include:

VITE_API_BASE_URL
VITE_USE_MOCK_API

When mock mode is enabled:
- use mock data/services
- do not perform real backend requests

When the real backend is introduced later:
- page components should require minimal changes

---

## Virtual Try-On architecture

Virtual Try-On is currently frontend/mock only.

Important requirements:

- A product-page Try On action must preserve the exact selected product.
- Preserve the selected colour where available.
- Customers must NOT have to search for the same product again after entering VTO from ProductPage.
- Direct entry from the navigation may require product selection.
- Do not display hundreds of products directly in the fitting-room workspace.
- Use a searchable product picker when product selection is needed.
- One uploaded customer photo should be reusable for multiple garments during the same fitting-room session.
- Switching garments must not require re-uploading the photo.
- VTO photos must remain browser-memory/session-only during this phase.
- Never persist VTO photographs to localStorage, sessionStorage, Zustand persistence, or mock database.
- Use URL.createObjectURL for local preview and revoke it correctly.
- Do not call a real VTO API yet.
- Mock outputs must be clearly identifiable as demo/prototype output.
- Explicit consent remains part of the VTO user experience.

Future production architecture:

React
→ Express backend
→ VTO provider

---

## Size Recommendation architecture

The client will provide the final machine-learning size model later.

The frontend must therefore remain model-agnostic.

Use the existing sizeRecommendationService and schema-driven measurement approach.

Do not hard-code one permanent set of ML inputs.

The backend/model should eventually determine which measurement fields are needed.

Size Recommendation should primarily appear beside the product size selector.

Expected result information includes:

- recommended size
- confidence
- expected fit
- explanation
- alternative size where available

A recommendation is guidance, not a guaranteed fit.

Do not use body-shaming language.

---

## Product page priorities

The Product Details page is one of the most important customer pages.

Normal hierarchy should remain:

1. Product information
2. Colour
3. Size selection
4. Size Recommendation
5. Virtual Try-On
6. Add to Bag

Add to Bag remains the primary commerce action.

Virtual Try-On is an important secondary action.

Size Recommendation should be visually associated with size selection.

---

## Design system

Preserve the existing VESTRA premium editorial fashion identity.

The storefront should feel:

- premium
- editorial
- modern
- minimal
- trustworthy
- fashion-focused

Do not turn it into:

- a SaaS interface
- generic AI landing page
- neon/glassmorphism design
- default Shadcn demo

Existing visual conventions should be preserved unless a redesign is explicitly requested.

AI features may use the existing indigo accent.

Standard commerce actions should remain neutral/black.

---

## Privacy rules

Treat customer photographs and body measurements carefully.

Virtual Try-On:

- never persist uploaded photos in browser storage
- do not falsely claim server-side processing while in mock mode
- do not expose provider API keys
- preserve explicit consent UI

Size Recommendation:

- collect only fields defined by the active form schema
- explain measurement purpose where appropriate
- allow measurements to be changed
- avoid certainty claims

---

## Change policy

Before changing code:

1. Inspect the existing implementation.
2. Reuse existing components/services/types wherever practical.
3. Modify the smallest reasonable set of files.
4. Do not regenerate working pages.
5. Do not duplicate existing functionality.
6. Do not restructure unrelated architecture.
7. Do not redesign unrelated pages.
8. Do not modify backend/ unless explicitly instructed.
9. Do not add dependencies unnecessarily.
10. Preserve existing working functionality.

For feature changes:

- implement one feature at a time
- keep changes scoped
- verify affected routes
- run npm run build
- fix TypeScript/build errors introduced by the change

---

## Current development state

Already implemented:

- Storefront/admin layout separation
- Protected customer/admin routing
- Admin product catalogue CRUD
- Product creation/editing
- Product duplication
- Publish/unpublish
- Product deletion
- Bulk catalogue actions
- CSV import
- Categories
- Inventory
- Existing storefront
- Customer account
- Cart/checkout prototype
- Mock authentication

Do NOT rebuild these from scratch.

Current major remaining frontend work:

1. Improve Virtual Try-On workflow
2. Implement/complete Size Recommendation UI
3. Later perform mock-data/image consistency and UI polish

Work on these incrementally.