# Notification UI Fix — Text Cutting Issue

## Issues Fixed

### 1. **Text Cutting & Overflow**
   - **Problem**: Long notification titles and messages were being cut off
   - **Root Cause**: Missing `word-break: break-word` and improper `white-space` handling
   - **Fix**: Added explicit word-breaking rules and proper text wrapping to all notification text elements

### 2. **Missing Typography Classes**
   - **Problem**: Used `.text-label-md`, `.text-label-sm` which don't exist in the design system
   - **Root Cause**: Inconsistent use of utility classes that weren't defined
   - **Fix**: Created dedicated, scoped CSS classes:
     - `.notif-title` — notification title (13px, bold)
     - `.notif-message` — notification body text (13px, regular)
     - `.notif-time` — timestamp (11px, muted)

### 3. **"Mark all read" Button Wrapping**
   - **Problem**: Button text could wrap or get cut off when header is narrow
   - **Root Cause**: No `white-space: nowrap` or `flex-shrink: 0` on the button
   - **Fix**: Added `white-space: nowrap` and `flex-shrink: 0` to prevent wrapping

### 4. **Dropdown Overflow**
   - **Problem**: Dropdown content could overflow outside the rounded corners
   - **Root Cause**: No `overflow: hidden` on parent container
   - **Fix**: Added `overflow: hidden` to `.notification-dropdown`

## CSS Changes Summary

### Before
```css
.notification-content p{
  margin: 0;
  overflow-wrap: break-word;
}
```

### After
```css
.notification-content .notif-title{
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-ink);
  white-space: normal;
  word-break: break-word;  /* ← explicit word breaking */
}

.notification-content .notif-message{
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--color-muted);
  white-space: normal;
  word-break: break-word;  /* ← explicit word breaking */
}
```

## Component Changes

Replaced undefined utility classes with dedicated CSS classes:

```tsx
// Before
<p className="text-label-sm">{notif.title}</p>
<p className="text-body-sm">{notif.message}</p>

// After
<p className="notif-title">{notif.title}</p>
<p className="notif-message">{notif.message}</p>
```

## Testing

To verify the fix:

1. Start the dev server: `npm run dev` (in `frontend/`)
2. Seed the database with notifications: `uv run python -m transitops.seed --reset` (in `backend/`)
3. Log in to the app
4. Click the bell icon
5. Check that:
   - Long notification titles wrap properly
   - Long messages don't overflow
   - "Mark all read" button doesn't wrap
   - Dropdown has clean rounded corners

## Files Modified

- `frontend/src/app/design-system.css` — rewrote notification styles with explicit text handling
- `frontend/src/components/notifications-popover.tsx` — replaced undefined utility classes
