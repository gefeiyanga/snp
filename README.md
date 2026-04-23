# Vue 3 + TypeScript + Less + PWA + LocalForage + Vant Project

This is a Vue 3 project configured with:
- TypeScript for type safety
- Less for CSS preprocessing
- Oxlint for linting
- Oxfmt for formatting
- PWA (Progressive Web App) functionality for "Add to Home Screen" support
- LocalForage for persistent structured data storage
- Vant 4 UI library for mobile components
- unplugin-auto-import and unplugin-vue-components for automatic imports
- VueUse for utility functions
- Mobile gesture control (disabled zoom, double-tap, and text selection)
- Development server running on port 3001

## Setup

Install dependencies with pnpm:
```bash
pnpm install
```

Create a `.env.local` file if you want real-time quote lookup for investment assets:
```bash
VITE_ALPHA_VANTAGE_API_KEY=your_api_key_here
```

This project currently integrates Alpha Vantage for quote lookup:
- Stocks / funds: `GLOBAL_QUOTE`
- Crypto: `CURRENCY_EXCHANGE_RATE`

## Development

Start the development server:
```bash
pnpm run dev
```
The application will be accessible at http://localhost:3001

## Building

Build the project for production:
```bash
pnpm run build
```

## Linting and Formatting

Lint the code:
```bash
pnpm run lint
```

Format the code:
```bash
pnpm run format
```

## PWA Features

This project includes PWA functionality that enables:
- "Add to Home Screen" capability on iOS and Android
- Offline functionality
- Installable app-like experience
- Custom icons for various device screen densities

## Persistent Data Storage

This project includes LocalForage for persistent structured data storage that works across browsers using IndexedDB, WebSQL, or localStorage as available. The project includes a composable `useStorage()` with convenient methods for:
- getItem(key) - Get an item from storage
- setItem(key, value) - Store an item
- removeItem(key) - Remove an item
- clear() - Clear all stored data
- length() - Get number of stored items
- keys() - Get all stored keys

## Vant UI Components

This project includes Vant 4 UI library with mobile-friendly components. The project is configured with `unplugin-vue-components` with `VantResolver` for automatic component imports and `unplugin-auto-import` for automatic API imports.

## Automatic Imports

The project includes:
- Automatic import of Vue APIs (ref, reactive, computed, etc.)
- Automatic import of Vant components (Button, Cell, Field, etc.)
- Automatic import of VueUse functions (useDark, onClickOutside, etc.)
- Automatic import of functions from composables and utils directories

## Mobile Optimizations

The project includes mobile-specific optimizations:
- Disabled zooming and scaling with viewport meta tag
- Disabled text selection and long-press context menu
- Removed tap highlights
- Allows text selection in form inputs where needed
