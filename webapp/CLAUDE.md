<stack>
  React 18 with Vite
  Use bun (not npm).
  React Router v6 for routing.
  React Query for server/async state.
  Tailwind v3 + shadcn/ui for styling and components.
  Framer Motion for animations.
  lucide-react for icons.
  Pre-installed shadcn/ui components.
</stack>

<structure>
  src/pages/        — Page components (manually routed in App.tsx). Add new pages to this folder.
  src/components/
    ui/             — shadcn/ui components (pre-built). Use these first.
  src/hooks/        — Custom React hooks. Add new hooks to this folder.
  src/lib/          — Utilities: utils.ts (cn helper for className merge)

  Create small, focused components instead of monolithic files.
  Do not write long Index.tsx or page files.
  Extract components into separate files.
  Organize components in a logical folder structure.
  </structure>

<typescript>
  Explicit type annotations for useState: `useState<Type[]>([])` not `useState([])`
  Null/undefined handling: use optional chaining `?.` and nullish coalescing `??`
  Include ALL required properties when creating objects — TypeScript is enabled.
  Make sure to use ternary operators instead of && for conditional rendering inside JSX.
</typescript>

<environment>
  You are in Vibecode. The system manages git and the dev server (port 8080).
  DO NOT: manage git, touch the dev server, or check its state.
  The user views the app through Vibecode App or their browser.
  The user cannot see the code or interact with the terminal. Do not tell the user to do anything with the code or terminal.
  You can see logs in the server.log file or browser console.
  The Vibecode App has tabs like ENV tab, API tab, LOGS tab. You can ask the user to use these tabs to view the logs, add environment variables, or give instructions for APIs like OpenAI, Nanobanana, Grok, Elevenlabs, etc. but first try to implement the functionality yourself.
  The user is likely non-technical, communicate with them in an easy to understand manner.
  If the user's request is vague or ambitious, scope down to specific functionality. Do everything for them.
  For images, use URLs from unsplash.com. You can also tell the user they can use the IMAGES tab to generate and upload images.
</environment>

<bootstrapping>
  This is a fresh workspace. src/pages/Index.tsx is a placeholder — it is NOT your app.
  When the user describes what they want to build, DELETE the entire contents of Index.tsx and build their app from scratch.
  Do not reuse any code, layout, or styling from the placeholder. It exists only to show something while the workspace is empty.
  The same applies to index.html — update the title, meta tags, and og tags to match whatever the user is building.
</bootstrapping>

<routing>
  React Router v6 for routing. Routes are manually registered in `src/App.tsx`.
  <adding_routes>
    1. Create a new page component in `src/pages/` (e.g., `src/pages/Settings.tsx`)
    2. Import it in `src/App.tsx`
    3. Add a Route inside the Routes component: `<Route path="/settings" element={<Settings />} />`
    4. Add new routes ABOVE the catch-all "*" route.
  </adding_routes>

  <navigation>
    Use `<Link to="/path">` for navigation links.
    Use `useNavigate()` hook for programmatic navigation.
    Use `useParams()` for URL params (e.g., /users/:id).
    Use `useSearchParams()` for query strings.
  </navigation>

  <nested_routes>
    For layouts with nested content, use `<Outlet />` from react-router-dom.
    Wrap child routes inside parent Route components.
  </nested_routes>

  <rules>
    Only ONE route can map to "/" — the Index page.
    The "*" catch-all route must always be LAST.
    Dynamic params: use `const { id } = useParams()` from react-router-dom.
  </rules>
</routing>

<state>
  Always use React Query for server/async state. 
  Always use object API: `useQuery({ queryKey, queryFn })`.
  React Query provider is already set up in App.tsx — use it.

  Use `useMutation` for async operations — no manual `setIsLoading` patterns.
  Reuse query keys across components to share cached data — don't create duplicate providers.

  For local state, use React hooks (useState, useReducer) or Zustand.
  For persistence: use localStorage. Only persist necessary data.
</state>

<data>
  Create realistic mock data when you lack access to real data.
  For image analysis: actually send to LLM don't mock.
</data>

<index_html>
  IMPORTANT: If index.html still has defaults ("Vibecode.dev App", "/og-base.png"), update title, og:title, og:description, og:image, and meta description to match the app.
</index_html>

<design>
  Don't hold back. This is web — design for desktop and mobile responsiveness.
  Inspiration: Linear, Vercel, Stripe, Notion, polished SaaS dashboards.
  Read the frontend-design skill for more details on design patterns and best practices.
  Use shadcn/ui components as building blocks — they're pre-installed and accessible.

  <avoid>
    Purple gradients on white, generic centered layouts, predictable patterns.
    Mobile-only designs on web. Overused fonts (Space Grotesk, Inter).
  </avoid>

  <do>
    Cohesive themes with dominant colors and sharp accents.
    High-impact animations: hover states, transitions, loading skeletons.
    Depth via shadows, borders, and subtle gradients.
    Use Google Fonts via CSS import or link tag in index.html for distinctive typography.
  </do>
</design>

<responsive>
  Always design mobile-first. Every page and component must work on mobile devices.

  <breakpoints>
    Mobile: < 768px (default styles, no prefix)
    Tablet: md: (768px+)
    Desktop: lg: (1024px+)
    Large: xl: (1280px+)
  </breakpoints>

  <useIsMobile_hook>
    Use `useIsMobile()` from `@/hooks/use-mobile` to conditionally render different UI for mobile vs desktop.
    ```tsx
    import { useIsMobile } from "@/hooks/use-mobile"

    function MyComponent() {
      const isMobile = useIsMobile()

      return isMobile ? <MobileNav /> : <DesktopNav />
    }
    ```
    Use this for: navigation patterns, sidebars, complex layouts that need entirely different components on mobile.
  </useIsMobile_hook>

  <best_practices>
    Prefer Tailwind responsive classes over useIsMobile when possible (CSS is faster).
    Use Sheet/Drawer instead of Dialog on mobile for better UX.
    Stack layouts vertically on mobile: `flex flex-col md:flex-row`
    Hide non-essential UI on mobile: `hidden md:block`
    Make touch targets at least 44px: `min-h-[44px] min-w-[44px]`
    Test with narrow viewport (375px width).
  </best_practices>
</responsive>

<styling>
  <styling>
    Use Tailwind for styling. Use cn() helper from src/lib/utils.ts to merge classNames when conditionally applying classNames or passing classNames via props.
    All shadcn/ui components support className prop.
    Use responsive classes: sm:, md:, lg:, xl: for different breakpoints.
    Make sure to ALWAYS a ShadCN component when available.
  </styling>

  <forms>
    Use react-hook-form for complex forms, not manual state management.
    Always validate with zod schemas.
    Use shadcn/ui form components for consistent styling.
  </forms>

  <ux>
    Use Button component from shadcn/ui, not raw HTML buttons.
    Use Dialog/AlertDialog from shadcn/ui, not window.alert() or window.confirm().
    Ensure forms are keyboard accessible and have proper focus management.
  </ux>

  <animations>
    Use Tailwind's built-in transitions for simple animations (hover, focus states).
    Use Framer Motion for complex animations (page transitions, staggered reveals).
    Don't over-animate — subtle is usually better.
  </animations>
</styling>

<backend>
  This app has a backend server at ../backend/.
  API requests use relative URLs by default (/api/...) so the app works on any domain in production.
  VITE_BACKEND_URL is only needed in development for cross-origin requests to the backend on a different port.
  DO NOT hardcode localhost URLs.

  To call backend APIs, use the api helper from src/lib/api.ts:
  ```typescript
  import { api } from "@/lib/api";
  const data = await api.get<MyType>("/api/your-endpoint"); // Always use /api/ prefix
  ```

  For setting up authentication and database, use the database-auth skill.

  <shared_types>
    API contracts are defined as Zod schemas in ../backend/src/types.ts.
    Import and use them to validate responses.
  </shared_types>
</backend>

<skills>
You have access to a few skills in the `.claude/skills` folder. Use them to your advantage.
- ai-apis-like-chatgpt: Use this skill when the user asks you to make an app that requires an AI API.
- web-docs: Use this skill when you need documentation for shadcn/ui, React Router, React Query, or other web libraries.
- frontend-app-design: Use this skill when the user asks you to design a frontend app component or screen.
</skills>
