Yes. I’d make the final DESIGN.md cleaner, calmer, and more distinctive than the earlier version—something Codex can actually implement consistently without turning the product into a generic dashboard or an over-animated mess.

DESIGN.md

Product Design System

This document defines the visual language, interaction principles, usability standards, and interface behavior for the product.

The goal is not to create the loudest interface.

The goal is to create a product that feels:

* simple;
* modern;
* premium;
* fast;
* memorable;
* intuitive;
* slightly playful;
* calm under complexity.

Users should rarely have to think about how the interface works.

The product should feel obvious.

⸻

1. DESIGN PHILOSOPHY

Our design philosophy is:

Quiet confidence with moments of delight.

The interface should remain visually calm while important actions, achievements, state changes, and transitions receive subtle personality.

We prefer:

* clarity over decoration;
* whitespace over clutter;
* hierarchy over excessive borders;
* meaningful animation over constant movement;
* progressive disclosure over showing everything;
* familiar interaction patterns with distinctive visual treatment.

The product should feel premium without feeling complicated.

⸻

2. CORE DESIGN PRINCIPLES

Every screen should follow these principles.

2.1 Make the next action obvious

Every major screen should answer:

1. Where am I?
2. What is happening?
3. What should I do next?

Avoid screens containing many equally prominent buttons.

Usually there should be:

* one primary action;
* a few secondary actions;
* everything else visually quieter.

Example:

Products
Manage the products available in your store.
                         [+ Add product]
------------------------------------------------
Search products...
Product                  Stock       Price
Silk Dress                18          ₦65,000
Luxury Bag                 7          ₦90,000

The user’s attention should naturally move toward:

+ Add product

⸻

3. SIMPLICITY RULE

Do not display complexity simply because the system supports complexity.

Use:

Simple by default. Powerful when needed.

Advanced settings should be hidden behind appropriate sections such as:

Basic Settings
Advanced Settings ▾

Do not overwhelm first-time users with every possible option.

⸻

4. VISUAL PERSONALITY

The visual personality should be:

Minimal
+
Soft
+
Structured
+
Premium
+
Responsive
+
Slightly futuristic

Avoid overly corporate interfaces.

Avoid excessive gradients.

Avoid excessive glassmorphism.

Avoid dozens of bordered cards.

Avoid giant shadows everywhere.

Avoid making every section look like a separate container.

⸻

5. COLOR SYSTEM

Do not build the interface around dozens of colors.

Use a small semantic system.

Core tokens:

background
surface
surface-muted
text-primary
text-secondary
text-muted
border
primary
primary-hover
primary-soft
success
warning
danger
info

Example light foundation:

Background      #F8F9FB
Surface         #FFFFFF
Muted Surface   #F1F3F5
Text Primary    #111318
Text Secondary  #5F6570
Border          #E6E8EC

The primary product accent should provide personality.

Do not use the primary accent across entire screens.

Use it primarily for:

* important buttons;
* active navigation;
* focused fields;
* selected items;
* progress;
* important interactive states.

⸻

6. DARK MODE

The system should be designed so dark mode can exist naturally.

Do not hard-code:

black
white
gray

inside components.

Use semantic design tokens.

Example:

--background
--surface
--surface-muted
--text-primary
--text-secondary
--border

The same component should work in multiple themes.

⸻

7. SPACING SYSTEM

Use an 8-point-based spacing system.

Primary spacing values:

4px
8px
12px
16px
24px
32px
40px
48px
64px

Common usage:

4px     tiny icon relationships
8px     closely related elements
12px    compact internal spacing
16px    normal component spacing
24px    card / component sections
32px    page sections
48px    major visual separation
64px    large page breathing room

Do not use random spacing values unless necessary.

⸻

8. PAGE STRUCTURE

Most application pages should follow:

Page Header
Title
Description                           Primary Action
Context / Filters
Main Content

Example:

Orders
Manage and fulfil customer orders.
                                [Export] [Create Order]
-------------------------------------------------------
All     Pending     Processing     Delivered
Search orders...                     Filter ▾
-------------------------------------------------------
Order        Customer        Total        Status

This consistency should make unfamiliar screens immediately understandable.

⸻

9. CONTENT WIDTH

Do not stretch content infinitely across large monitors.

Use reasonable content widths.

General application pages:

max-width: approximately 1440px

Text-heavy content:

approximately 680–800px

Configuration forms:

approximately 600–800px

Dashboards may use wider layouts where useful.

⸻

10. TYPOGRAPHY

Typography should be clean and highly readable.

Recommended interface style:

Sans-serif
Neutral
Modern
High legibility

Suggested families include:

Inter
Geist
Manrope
DM Sans

Use one primary interface font.

Do not randomly mix fonts inside the application.

⸻

11. TYPE SCALE

Example scale:

Display       40–48px
Page Title    28–32px
Section       20–24px
Card Title    16–18px
Body          14–16px
Secondary     13–14px
Caption       12px

Use weight more sparingly than size.

Avoid making every heading bold.

⸻

12. VISUAL HIERARCHY

A user should understand the screen before reading every word.

Hierarchy should come from:

1. position;
2. spacing;
3. typography;
4. contrast;
5. color.

Not everything needs a border.

Not everything needs a card.

⸻

13. CARDS

Cards should group genuinely related information.

Good:

Revenue
₦1,420,000
↑ 18.4% this month

Bad:

Creating a separate card for every sentence or UI element.

Card style:

subtle border
minimal shadow or no shadow
comfortable padding
moderate radius

Recommended radius:

10px–16px

⸻

14. BUTTONS

Primary button:

Filled
High contrast
Clear action

Secondary:

Subtle surface or outline

Tertiary:

Text / ghost style

Danger:

Reserved for destructive operations

Do not place five primary-looking buttons next to one another.

Minimum interactive target:

44 × 44px

Typical button height:

40–48px

⸻

15. FORMS

Forms should feel simple.

Labels always remain visible.

Bad:

[ Your email address here... ]

with no permanent label.

Better:

Email address
[ name@example.com ]

Descriptions should only appear when they help.

Example:

Custom Domain
[ shop.example.com ]
Connect a domain you already own.

⸻

16. FORM GROUPING

Long forms must be separated into logical sections.

Example:

Business Profile
Business name
Description
Industry
Contact
Email
Phone
WhatsApp
Location
Country
State
Address

Do not present 25 unrelated inputs in one uninterrupted column.

⸻

17. MULTI-STEP FLOWS

Use step-based flows for complex processes.

Suitable for:

* onboarding;
* checkout;
* integrations;
* domain configuration;
* initial business setup.

Example:

Business → Design → Payments → Domain → Launch

Each step should contain a focused amount of information.

Prefer approximately:

3–6 meaningful decisions per step

when possible.

⸻

18. TABLES

Tables are important for admin products.

They should prioritize scanning.

Use:

* aligned columns;
* clear headers;
* subtle row separation;
* status indicators;
* appropriate whitespace;
* sticky header where useful;
* pagination for large datasets.

Avoid excessive borders around every cell.

Example:

ORDER       CUSTOMER         TOTAL       STATUS
#1038       Jane Doe         ₦72,000     ● Paid
#1037       Michael          ₦45,000     ● Pending

⸻

19. STATUS DESIGN

Statuses should combine:

color
+
text

Never use color alone.

Examples:

● Active
● Pending
● Failed
● Suspended

Keep status colors consistent globally.

⸻

20. EMPTY STATES

Empty screens should be useful rather than depressing.

Bad:

No products.

Better:

Your product catalogue is empty.
Add your first product and start building your store.
[ Add Product ]

Optional small illustrations or icons may be used.

Keep them restrained.

⸻

21. ERROR STATES

Errors must:

* explain what happened;
* explain what the user can do;
* preserve existing work where possible.

Bad:

Error 500.

Better:

We couldn't save your changes.
Your edits are still here. Check your connection and try again.
[ Try Again ]

⸻

22. LOADING STATES

Prefer skeleton interfaces over large loading spinners.

Skeletons should approximately match the content being loaded.

Example:

████████████
██████   ██████████
██████████████████
██████████████████

Use spinners only for small isolated actions where the structure is already visible.

⸻

23. MOTION PHILOSOPHY

Animation should make the interface feel alive.

It should never make it feel slow.

Animations should communicate:

* state;
* hierarchy;
* movement;
* success;
* continuity.

They should not exist simply because animation is possible.

⸻

24. MOTION SYSTEM

Recommended general easing:

cubic-bezier(0.16, 1, 0.3, 1)

Typical durations:

Micro interaction      100–180ms
Small transition       180–240ms
Panel / modal           220–320ms
Page element entrance   250–400ms

Avoid animations longer than approximately 500ms for common interface operations.

⸻

25. MICRO-INTERACTIONS

Useful examples:

Button press:

slight scale down
→ release

Toggle:

track transition
+
thumb movement

Successful save:

Save
→ Saving...
→ ✓ Saved

Navigation selection:

subtle animated active indicator

Card selection:

border/background transition

⸻

26. PAGE ENTRANCE

Pages should not dramatically fly onto the screen.

A subtle entrance can be:

opacity 0 → 1
translateY 6px → 0

Duration:

250–350ms

Only major content groups should animate.

Do not stagger twenty table rows every time a user changes screens.

⸻

27. SUCCESS MOMENTS

Important achievements may receive slightly more personality.

Examples:

* store published;
* domain connected;
* first sale;
* setup completed;
* payment configured.

Possible treatment:

✓ Your store is live

with:

* subtle icon animation;
* soft accent pulse;
* small controlled confetti effect for significant milestones.

Confetti should be rare.

It should never appear for routine operations.

⸻

28. HOVER STATES

Desktop controls should clearly respond to hover.

Examples:

background shift
border change
slight elevation

Never make content move significantly on hover.

Important actions must remain discoverable without hover.

⸻

29. MODALS

Use modals for focused temporary tasks.

Good:

* confirmation;
* quick edit;
* small creation flow.

Bad:

* entire settings screens;
* complex dashboards;
* long multi-step forms.

Use full pages or side panels for complex operations.

⸻

30. SIDE PANELS

Side panels are useful for contextual editing.

Example:

Orders Table             | Order #1044
                         |
                         | Customer
                         | Payment
                         | Delivery
                         | Timeline

This helps users maintain context.

⸻

31. DESTRUCTIVE ACTIONS

Destructive operations should not be accidentally triggered.

Examples:

* delete business;
* delete product;
* remove integration;
* cancel subscription.

Require confirmation.

For highly destructive actions, confirmation may require entering identifying text.

Example:

Delete business?
This action permanently deletes business data.
Type DELETE to continue.

Do not make routine actions require excessive confirmation.

⸻

32. NAVIGATION

Primary navigation should remain predictable.

Desktop:

Sidebar

Mobile:

Compact navigation / drawer

Group navigation logically.

Example:

Overview
Commerce
  Products
  Orders
  Customers
Website
  Pages
  Design
  Navigation
  SEO
Marketing
  Email
  SMS
Settings

Avoid 20 ungrouped sidebar items.

⸻

33. ICONS

Use one consistent icon library.

Icons should complement labels rather than replace necessary text.

Recommended:

Lucide

Use consistent stroke width and sizing.

⸻

34. RESPONSIVE DESIGN

Mobile is not a smaller desktop.

Layouts should reorganize.

Desktop:

sidebar + content

Mobile:

top navigation
single column
important actions accessible

Tables may transform into:

* horizontally scrollable structures;
* cards;
* condensed rows.

Choose based on information density.

⸻

35. MOBILE ACTIONS

On mobile, important actions should remain easy to reach.

Examples:

Save
Checkout
Continue
Publish
Add Product

Sticky bottom action bars are acceptable for high-value workflows.

Do not cover important content.

⸻

36. ACCESSIBILITY

Accessibility is not optional.

Target:

WCAG AA

Requirements:

* keyboard navigation;
* visible focus indicators;
* semantic HTML;
* appropriate labels;
* accessible dialogs;
* sufficient contrast;
* screen-reader descriptions where needed;
* reduced-motion support;
* minimum touch targets.

⸻

37. REDUCED MOTION

Respect:

@media (prefers-reduced-motion: reduce)

When enabled:

* remove decorative animation;
* minimize movement;
* preserve functional state changes.

⸻

38. PERFORMANCE UX

The interface should react immediately whenever possible.

For actions such as:

toggle setting
rename item
reorder item

optimistic UI may be used when safe.

Pattern:

User action
→ UI updates immediately
→ server request
→ success
or
→ rollback + clear error

Do not use optimistic updates for irreversible financial or destructive operations without careful guarantees.

⸻

39. SAVE EXPERIENCE

Avoid making users wonder whether settings were saved.

Use explicit states:

Unsaved changes
Saving...
✓ Saved

For settings areas, either:

* autosave safely;
* or present a persistent Save button.

Do not mix patterns unpredictably.

⸻

40. SEARCH

Search should be immediately available on data-heavy pages.

Search inputs should:

* have clear placeholder text;
* debounce requests;
* communicate no-result states;
* preserve active filters.

Example:

Search products by name or SKU...

⸻

41. FILTERING

Filters should be simple first.

Common filters visible.

Advanced filters can live under:

More Filters

Active filters should be clearly removable.

⸻

42. NOTIFICATIONS

Use notifications carefully.

Toast notifications are appropriate for:

Saved
Copied
Product created
Invitation sent

Do not show ten toasts simultaneously.

Persistent issues belong in banners or inline errors.

⸻

43. BADGES

Badges should communicate information, not decorate.

Examples:

New
Growth
Active
Beta
3

Avoid excessive badges.

⸻

44. ONBOARDING EXPERIENCE

Onboarding should focus on reaching useful value quickly.

Example:

1. Business
2. Design
3. Products
4. Payments
5. Launch

Show progress.

Allow users to return.

Avoid forcing configuration that isn’t required to launch.

⸻

45. CHECKLIST PATTERN

After onboarding, a setup checklist may remain.

Example:

Your store is 70% ready
✓ Business profile
✓ Logo
✓ First product
○ Configure payments
○ Connect domain
○ Setup SEO

The checklist should disappear or collapse once completed.

⸻

46. DASHBOARD PHILOSOPHY

Dashboards should answer:

What needs my attention?

Not:

How many charts can we fit here?

Prioritize:

Important metrics
Pending actions
Recent activity
Problems
Opportunities

Example:

Good afternoon, Ada.
Here's what's happening today.
Revenue Today       Orders       Pending
₦320,000              12             3
Needs Attention
2 orders awaiting fulfilment
1 product low on stock

⸻

47. DATA VISUALIZATION

Use charts only when they reveal information better than numbers.

Charts should be:

* simple;
* labelled;
* interactive where useful;
* accessible.

Avoid:

* 3D charts;
* rainbow charts;
* excessive gradients;
* decorative visualization.

⸻

48. FEATURE-LOCKED UX

When a feature belongs to another pricing tier, it should not look broken.

Example:

Advanced SEO
Control canonical URLs, structured data
and social previews.
Available on Growth.
[ Upgrade ]

Rules:

* explain value;
* show required tier;
* avoid constant nagging;
* never automatically open upgrade modals;
* never block unrelated workflows.

⸻

49. CUSTOMIZATION

User customization should feel empowering without creating chaos.

Support controlled customization.

Examples:

Color
Typography
Layout
Content
Sections
Images
Navigation
SEO

Avoid providing unrestricted configuration that destroys consistency or accessibility.

⸻

50. LIVE PREVIEW

Customization interfaces should provide preview where practical.

Example:

┌──────────────┬─────────────────────────┐
│              │                         │
│ Settings     │       Live Preview      │
│              │                         │
│ Headline     │                         │
│ Colors       │                         │
│ Layout       │                         │
│ Buttons      │                         │
│              │                         │
└──────────────┴─────────────────────────┘

The preview should closely match production rendering.

⸻

51. EDITABLE CONTENT UX

Content editing should be approachable.

Example:

Hero Heading
[ Luxury made effortless ]
Keep this short and memorable.

Do not expose users to:

hero_block.content_json.heading

The database can be complex.

The interface must not be.

⸻

52. SEO EDITOR

SEO settings should be understandable to non-technical users.

Example:

Search Result Preview
Xelle — Luxury Fashion in Lagos
xelle.ng
Discover curated luxury fashion
designed for every occasion.
SEO title
[ Xelle — Luxury Fashion in Lagos ]
44 / 60
Description
[ Discover curated luxury fashion... ]
142 / 160

Advanced SEO settings can remain collapsed.

⸻

53. PROGRESSIVE DISCLOSURE

Do not show:

Canonical URL
Schema JSON
Robots configuration
OpenGraph controls
Twitter metadata

to every beginner immediately.

Structure:

SEO
Title
Description
Social Image
Advanced SEO ▾

⸻

54. TOOLTIP RULE

Tooltips are explanations, not hiding places for essential information.

Never require users to hover to understand critical controls.

⸻

55. COPY STYLE

Interface text should be:

Short
Human
Direct
Calm
Helpful

Bad:

The operation was successfully completed.

Better:

Product saved.

Bad:

Kindly input the required information below.

Better:

Enter your business details.

⸻

56. PERSONALITY

Small moments of personality are encouraged.

Examples:

Your store is live. Nice.
Everything looks good here.
No orders waiting. You're all caught up.
First sale 🎉

Do not turn every sentence into a joke.

⸻

57. PREMIUM FEEL

Premium design comes primarily from:

spacing
typography
alignment
motion
restraint
quality imagery
consistency

Not from:

gold gradients
giant shadows
glass everywhere
excessive animations

⸻

58. COMPONENT CONSISTENCY

Common components should come from a shared component library.

Examples:

Button
Input
Select
Textarea
Checkbox
Toggle
Tabs
Badge
Avatar
Modal
Drawer
Tooltip
Toast
Table
Card
Dropdown
Pagination
EmptyState
Skeleton
CommandMenu

Do not recreate basic components differently on every page.

⸻

59. COMPONENT STATES

Every interactive component should account for:

default
hover
focus
active
disabled
loading
error
success where relevant

⸻

60. DESIGN TOKENS

Centralize tokens.

Example:

colors
spacing
radius
shadows
typography
motion
z-index
breakpoints

Do not scatter design values throughout application files.

⸻

61. RADIUS SYSTEM

Use a restrained radius system.

Example:

small       6px
medium      10px
large       14px
xl          20px
pill        999px

Avoid randomly mixing radius values.

⸻

62. SHADOW SYSTEM

Shadows should be subtle.

Recommended categories:

none
soft
floating
overlay

Most normal cards should use:

none
or
soft

Dialogs/dropdowns may use stronger elevation.

⸻

63. FOCUS

Keyboard focus should be clearly visible.

Use:

outline / ring

that follows the primary accent while maintaining contrast.

Do not remove focus indicators.

⸻

64. TRANSITIONS

Property transitions should be selective.

Prefer animating:

opacity
transform
background-color
border-color
box-shadow

Avoid unnecessarily animating layout properties that cause expensive reflow.

⸻

65. SCROLL BEHAVIOR

Do not hijack normal scrolling.

Avoid forced scroll animations.

Smooth scroll may be used for:

* anchor navigation;
* controlled builder navigation.

⸻

66. DRAG AND DROP

Drag-and-drop is acceptable for:

section ordering
image ordering
navigation ordering

But there should also be an accessible alternative when practical:

Move Up
Move Down

⸻

67. KEYBOARD PRODUCTIVITY

Power-user areas may support shortcuts later.

Examples:

/        Search
N        New item
Esc      Close panel

Never interfere with typing inside inputs.

⸻

68. SPECIAL MOMENTS

The product can have signature interactions.

Examples:

Publish

When the user publishes their website:

button compresses slightly
→ loading pulse
→ success check animates
→ preview subtly brightens
→ "Your changes are live"

Domain Connection

Checking DNS...
○ Domain detected
○ SSL configured
● Website secured

Progress visually moves through states.

First Sale

A restrained celebratory animation may appear once.

These special moments give the product identity.

⸻

69. DO NOT OVER-ANIMATE

Never animate:

* every table row constantly;
* every card continuously;
* background elements for no reason;
* numbers endlessly;
* navigation unnecessarily.

Motion should become nearly invisible during routine use.

⸻

70. DESIGN REVIEW CHECKLIST

Before completing a screen, ask:

Is the next action obvious?
Can anything be removed?
Is the hierarchy clear?
Are related items grouped?
Is there enough whitespace?
Is mobile behavior defined?
Are loading states defined?
Are empty states defined?
Are errors understandable?
Does keyboard navigation work?
Does this animation help understanding?
Can the user complete this without documentation?
Does this feel like the same product as every other screen?

⸻

71. FINAL DESIGN RULE

When faced with multiple design options:

Choose the option that makes the user think less.

If two versions are equally usable:

Choose the simpler one.

If two versions are equally simple:

Choose the more elegant one.

If animation improves understanding:

Use it.

If animation only makes the interface look busy:

Remove it.

The final experience should feel:

Simple enough for a first-time user.
Powerful enough for an experienced user.
Beautiful enough to remember.
Quiet enough to use every day.

This is the version I’d actually put in the repository as DESIGN.md. It gives Codex enough constraints to keep the whole product visually consistent, while still leaving room for the product to develop its own personality instead of looking like a rigid template.

# Apple-Inspired Product Experience Standard

## 1. The Core Question

Before designing, modifying, or approving any user-facing interaction, the agent must stop and ask:

> **“If Apple were designing this exact interaction for a first-party product, how would they make it feel obvious, immediate, calm, polished, and effortless?”**

This is not an instruction to visually clone Apple.

It is an instruction to apply the level of product thinking associated with highly refined consumer software:

* strong information hierarchy
* immediate interaction feedback
* minimal cognitive load
* deliberate whitespace
* predictable navigation
* progressive disclosure
* excellent typography
* clear system status
* subtle motion
* responsive layouts
* consistency
* accessibility
* forgiving interactions
* attention to edge cases

When the correct UX approach is not obvious, **do not guess**.

Research the current Apple Human Interface Guidelines and high-quality comparable products before implementing the interaction.

The agent must determine:

1. What is the user's intention?
2. What does the user expect to happen immediately after interacting?
3. What feedback confirms that their action was registered?
4. What information does the user actually need at this moment?
5. Can anything unnecessary be removed?
6. Is the navigation obvious without explanation?
7. Does the interface preserve context?
8. Does the user always know where they are?
9. What happens under slow network conditions?
10. What happens when the action fails?
11. What happens when there is no data?
12. What happens when there is a lot of data?
13. What happens on mobile, tablet, laptop, and wide desktop displays?
14. Is there a better native or familiar interaction pattern?
15. **What would Apple do here, and why?**

The answer to the final question should influence the implementation, but product requirements and web-platform conventions still take precedence.

---

# 2. Perceived Performance Is a Product Requirement

The interface must never feel unresponsive.

A technically successful application that feels slow is still a poor user experience.

Every meaningful interaction must provide immediate visual acknowledgment.

When a user clicks:

* Save
* Continue
* Publish
* Create
* Delete
* Submit
* Add product
* Update order
* Change settings
* Navigate
* Upload
* Generate
* Apply
* Search
* Filter

the interface must immediately communicate that something happened.

Never leave the user wondering:

> “Did I actually click it?”

## Mandatory Interaction States

Interactive operations must account for:

**Idle → Pressed → Loading → Success / Error**

Where appropriate, also support:

**Disabled, Empty, Retry, Partial Success, Offline and Unsaved Changes.**

A button performing an asynchronous action should normally:

* react visually immediately on press
* prevent accidental duplicate submissions
* retain approximately the same dimensions while loading
* show a subtle spinner or progress state
* optionally change its text to a useful status such as `Saving…`
* resolve clearly into success or error

Do not make users stare at a frozen button.

Apple's Human Interface Guidelines emphasize that progress feedback should reassure people that an application has not stalled.

---

# 3. Prefer Skeletons Over Blank Screens

When loading structured content such as:

* dashboards
* orders
* product lists
* analytics
* tables
* cards
* customer information
* store configuration

preserve the expected page structure while data loads.

Prefer:

**existing content → subtle loading state → updated content**

or:

**skeleton layout → rendered content**

instead of:

**blank page → giant spinner → page suddenly appears**

Skeletons should resemble the eventual content hierarchy without becoming distracting animations.

If existing information can remain safely visible while refreshing, keep it visible.

Do not destroy context unnecessarily.

---

# 4. Navigation Must Feel Instant

Navigation should respond immediately.

When moving between dashboard sections:

* visually select the destination immediately
* preserve the application shell whenever possible
* do not unnecessarily rebuild the entire interface
* show loading states inside the changing content region
* prefetch likely destinations where appropriate
* avoid full-page flashes
* avoid unnecessary layout shifts

The persistent interface should feel stable while content changes.

The user should feel like they are moving **within an application**, not opening an entirely new website every time they click something.

---

# 5. Business Owner Dashboard: Desktop Sidebar Architecture

The Business Owner Admin Dashboard should use a **responsive application-shell layout with a persistent sidebar on appropriate desktop widths**.

Large arbitrary left and right padding should not be used as a substitute for application navigation.

A business management platform naturally contains multiple functional areas and therefore benefits from persistent hierarchical navigation.

Apple's own interface guidance recommends sidebar and split-view navigation for more complex information hierarchies.

## Recommended Desktop Structure

```text
┌─────────────────────────────────────────────────────────────────┐
│ Sidebar │                    Main Content                        │
│         │                                                        │
│ Logo    │ Page title                              Actions         │
│         │ Context / breadcrumb                                     │
│ Home    │ ───────────────────────────────────────────────────── │
│ Orders  │                                                        │
│ Products│                    Page Content                         │
│ Customers│                                                       │
│ Analytics│                                                       │
│         │                                                        │
│ Website │                                                        │
│ Marketing│                                                       │
│         │                                                        │
│ Settings│                                                        │
│ ─────── │                                                        │
│ Account │                                                        │
└─────────────────────────────────────────────────────────────────┘
```

The sidebar establishes persistent spatial memory.

A user should learn:

> Orders are always here.
> Products are always here.
> Analytics is always here.

Controls should not move unnecessarily between screens.

---

# 6. Sidebar Behaviour

The sidebar should feel quiet, useful and stable.

Do not create an oversized decorative sidebar.

It exists primarily for orientation and navigation.

Recommended groups may include:

### Core

* Overview
* Orders
* Products
* Customers

### Growth

* Analytics
* Marketing
* Discounts / Promotions

### Business

* Website / Store
* Payments
* Delivery / Fulfilment

### System

* Settings
* Help

The exact information architecture must be determined from actual implemented BusinessCare functionality rather than blindly copying this example.

Do not expose navigation for features that do not exist.

Use grouping only where grouping improves comprehension.

---

# 7. Active Navigation State

A user must always understand where they are.

The active sidebar item should have:

* a clear selected state
* subtle background differentiation
* appropriate icon treatment
* readable label
* sufficient contrast

Avoid aggressive highlights.

Selection should be obvious without dominating the interface.

Page headings must also reinforce location.

For example:

```text
Products
Manage your catalogue, inventory and availability.
```

not merely:

```text
Dashboard
```

on every page.

Apple recommends useful, concise titles that help users understand their current location.

---

# 8. Responsive Sidebar

Do not force desktop navigation onto mobile.

### Wide desktop

Persistent expanded sidebar.

### Medium desktop/tablet

Collapsed sidebar or narrower navigation rail where useful.

### Mobile

Sidebar becomes a temporary drawer, sheet, or appropriate compact navigation pattern.

Primary actions must remain easily reachable.

The same underlying information architecture should remain consistent across screen sizes.

Do not radically rearrange navigation merely because the viewport becomes smaller.

---

# 9. Content Width

A sidebar does not mean content should stretch infinitely.

Use intentional maximum widths based on the type of information.

For example:

* forms should remain comfortably readable
* analytics may use more horizontal space
* data tables may use most of the available viewport
* settings pages may use narrower content areas
* dashboards can use responsive grids

Do not apply one arbitrary `max-width` to every screen.

Do not create huge empty gutters simply because a screen is large.

Whitespace must communicate hierarchy, not waste space.

---

# 10. Motion Must Explain

Animations must have a functional purpose.

Use motion to communicate:

* state changes
* hierarchy
* navigation
* success
* insertion
* removal
* expansion
* collapse
* continuity

Do not animate merely because animation is possible.

Transitions should generally be:

* fast
* subtle
* interruptible
* physically believable
* consistent

A dropdown can gently appear.

A sidebar may smoothly collapse.

A saved setting may quietly confirm itself.

A modal may subtly enter from the spatial direction that makes sense.

Do not turn routine administration into a cinematic experience.

---

# 11. Optimistic UI

Where failure risk is low and rollback is safe, consider optimistic UI.

Examples may include:

* toggling preferences
* favouriting
* simple status changes
* rearranging items
* switching views

The interface may visually update immediately while the server operation completes.

If the operation fails:

* revert safely
* explain what happened
* provide recovery

Do not use optimistic UI for operations where pretending success could create financial, inventory, fulfilment, security or data-integrity problems.

---

# 12. Never Hide System Status

The user should always be able to understand whether an operation is:

* waiting
* processing
* completed
* failed
* partially completed

Avoid vague feedback.

Bad:

```text
Loading...
```

Better:

```text
Publishing website…
```

Bad:

```text
Something went wrong.
```

Better:

```text
We couldn't publish your changes. Your edits are still saved here.
Try again
```

Status messages should explain useful consequences.

---

# 13. Preserve User Work

Never destroy entered information because:

* an API failed
* validation failed
* the network disconnected
* the user navigated backwards
* submission timed out

Unless there is an unavoidable technical/security reason.

Forms, especially:

* business onboarding
* product creation
* website configuration
* checkout configuration
* business settings

should aggressively protect user-entered data.

Where appropriate:

* locally preserve drafts
* autosave
* clearly indicate saved/unsaved state
* restore recoverable sessions

A failed submission should not become a punishment.

---

# 14. Success Feedback

Do not overcelebrate routine actions.

A successful save usually needs:

* a small confirmation
* inline status
* toast
* subtle checkmark

not:

* giant modals
* confetti
* blocking dialogs
* multiple notifications

Save celebration for meaningful milestones, such as:

* first store published
* first product created
* first sale
* completed onboarding

The intensity of feedback should match the importance of the event.

---

# 15. Error Design

Errors are part of the interface.

They must be designed deliberately.

Every failure state must answer:

1. What happened?
2. Did we lose anything?
3. What can I do now?

Bad:

```text
Error 500
```

Bad:

```text
Unable to process request.
```

Better:

```text
We couldn't save the product.

Your changes are still here. Check your connection and try again.
```

Provide an actionable recovery path wherever possible.

---

# 16. Loading Hierarchy

Not every asynchronous operation deserves the same loading treatment.

### Tiny background operation

Use subtle inline feedback.

### Button operation

Use button loading state.

### Section refresh

Use skeleton/content-level indicator.

### Full route requiring data

Preserve the app shell and skeleton the page content.

### Long-running operation

Use explicit progress and describe what is occurring.

### Multi-stage operation

Display the current meaningful stage where useful.

Never block the entire interface unnecessarily.

---

# 17. Avoid Spinner Abuse

A spinner is not the solution to every wait.

Prefer:

* optimistic updates
* skeletons
* progressive rendering
* cached content
* prefetching
* stale-while-revalidate behaviour
* instantaneous local state transitions

before defaulting to a spinner.

The objective isn't:

> “Show loading.”

The objective is:

> **“Make waiting understandable — or eliminate the perception of waiting entirely.”**

---

# 18. Performance Investigation Is Mandatory

Do not attempt to solve perceived slowness exclusively through animation.

If an interaction feels slow, investigate the actual cause.

Inspect:

* unnecessary server round trips
* sequential API requests that could run concurrently
* oversized JavaScript bundles
* excessive React rerenders
* uncached requests
* unnecessary authentication checks
* database query latency
* image payloads
* blocking third-party scripts
* route transitions
* server component boundaries
* hydration overhead
* repeated fetches
* API cold starts
* middleware
* expensive client state operations

A loading animation may improve perception.

It does not excuse poor performance.

---

# 19. Interaction Budget

Treat responsiveness as a measurable requirement.

For every major interaction, inspect:

```text
Input
↓
Visual acknowledgement
↓
Application work
↓
Result
```

**Visual acknowledgement should feel immediate.**

If the final operation cannot be immediate, the system must immediately communicate what is happening.

No important button should appear dead after being clicked.

---

# 20. Progressive Disclosure

Do not expose every capability simultaneously.

Advanced configuration should appear when it becomes relevant.

For example, rather than showing twenty product settings immediately:

```text
Basic information
Pricing
Inventory

Advanced options >
```

This reduces intimidation without removing capability.

Complexity should exist in the product where required, but users should encounter it gradually.

---

# 21. Default to Familiarity

Do not invent new interactions when users already understand an established one.

Before creating a custom pattern, ask:

> Is there already a familiar interface convention for this?

Prefer recognisable patterns for:

* navigation
* filters
* search
* tables
* selection
* forms
* dialogs
* destructive actions
* pagination
* sorting
* account controls

Innovation should solve a user problem, not merely create novelty.

---

# 22. Reduce Decisions

Every screen should have an obvious primary purpose.

Ask:

> “What is the most likely thing the user came here to accomplish?”

That action should receive the strongest visual emphasis.

Secondary actions should remain accessible without competing equally for attention.

Avoid screens containing five buttons that all visually scream:

> CLICK ME.

Hierarchy is part of usability.

---

# 23. Contextual Controls

Show controls near the thing they affect.

An action relating to a product belongs close to the product.

An order status control belongs with the order.

Page-level actions belong near the page heading or appropriate toolbar.

Avoid scattering related controls across unrelated parts of the screen.

Apple's toolbar guidance similarly emphasizes grouping controls and actions logically around the content they affect.

---

# 24. Empty States Must Be Useful

An empty state is often a new user's first experience.

Never show only:

```text
No products.
```

Use empty states to teach.

For example:

```text
No products yet

Add your first product to start building your online store.

[ Add product ]
```

Where appropriate, include a concise explanation or preview.

---

# 25. The "Apple Review" Before Completion

Before declaring any UI feature complete, the agent must perform an **Apple Review**.

Ask:

### Clarity

Can someone understand this screen without instructions?

### Hierarchy

Is the most important information visually dominant?

### Feedback

Does every interaction acknowledge the user immediately?

### Navigation

Does the user always know where they are and how to leave?

### Continuity

Does the interface maintain context during transitions?

### Performance

Does the interaction actually perform quickly?

### Perceived Performance

If processing takes time, does the interface still feel responsive?

### Restraint

Can anything unnecessary be removed?

### Consistency

Does the behaviour match equivalent interactions elsewhere?

### Accessibility

Does the experience work with keyboard navigation, focus states, reduced motion, contrast requirements and assistive technologies?

### Responsiveness

Does it remain coherent across supported viewport sizes?

### Edge Cases

What happens during loading, empty, error, offline, duplicate action, timeout, slow network, partial result and unexpectedly large data states?

### Delight

Is there a subtle opportunity to make the experience feel exceptionally polished without making it distracting?

Only after answering these questions should the feature be considered UI-complete.

---

# 26. Research Rule

For significant UX decisions, the agent must not rely solely on its internal assumptions.

Research when appropriate:

1. Current Apple Human Interface Guidelines.
2. The equivalent interaction in first-party Apple applications where relevant.
3. Established best practices for modern web applications.
4. Comparable high-quality SaaS products.
5. Accessibility requirements.
6. Mobile and desktop conventions.

The agent should extract the underlying principle rather than blindly copy visual styling.

The question is not:

> “How do I make this look like Apple?”

The question is:

> **“Why would Apple make this decision, and how do we apply the underlying UX principle appropriately to BusinessCare?”**

---

# 27. Product Experience Principle

BusinessCare should feel simpler than the complexity underneath it.

The system may contain:

* commerce
* websites
* orders
* inventory
* payments
* customers
* analytics
* marketing
* delivery
* configuration

but the merchant should never feel like they are operating all of those systems simultaneously.

The interface must progressively translate complexity into understandable actions.

The desired experience is:

**Powerful underneath.
Simple on the surface.
Immediate when touched.
Predictable when navigated.
Forgiving when mistakes happen.
Quiet when nothing requires attention.**

That is the standard.
