module.exports = {
    // Bot Behavior
    DRY_RUN: false, // Set to true to verify logic without clicking "Send"
    MAX_CARDS: 10, // Maximum cards to process per run (0 = infinite)
    SCROLL_VARIANCE: 50, // Pixels to vary when scrolling
    ACTION_DELAY: { min: 5000, max: 10000 },
    BETWEEN_CARDS_DELAY: { min: 10000, max: 15000 }, // Wait time after processing one person before moving to next
    TEXT_ANIMATION_SPEED: 0, // Speed of typewriter effect in GUI (ms per char)

    // Selectors derived from prompt.txt and analysis
    SELECTORS: {
        // Main Catch Up List (updated for new LinkedIn HTML structure - April 2026)
        CATCH_UP_CONTAINER: 'div[role="list"][data-testid="lazy-column"]',
        PROFILE_CARD: 'div[role="listitem"]',

        // Within a Card - Profile identification
        PROFILE_FIGURE: 'figure svg[aria-label$="profile picture"]', // SVG with aria-label "Name's profile picture"
        THREE_DOTS_MENU: 'a[aria-label="Settings menu"]',           // Three-dots overflow menu

        // Card text elements (use structural queries instead of class-based)
        CARD_HEADLINE: 'p',                                         // First <p> in card content area = name
        REPLY_BUTTON: 'button[aria-label^="Reply to"], button[data-control-name="reply"]',
        DISMISS_BUTTON: 'button[aria-label="Dismiss"]',

        // The "Message" button on the card (still uses href prefix - stable)
        MESSAGE_BUTTON: 'a[href*="/messaging/compose"], a[aria-label^="Message "]',

        // Quick Reply Chips (when Detail View is open or inline)
        QUICK_REPLY_CHIP: 'button.msg-form__quick-reply-chip',

        // Messaging Overlay
        OVERLAY_CONTAINER: 'div.msg-overlay-conversation-bubble',
        OVERLAY_CLOSE_BUTTON: 'button.msg-overlay-bubble-header__control',
        MESSAGE_LIST: 'ul.msg-s-message-list',
        MY_MESSAGE: 'li.msg-s-message-list__event--mine',

        // Post Interaction (Likes/Comments) - ON CATCH UP CARD
        LIKE_BUTTON_ACTIVE: 'svg#like-consumption-medium',                          // Already liked (blue filled)
        LIKE_BUTTON_INACTIVE: 'svg#thumbs-up-outline-medium',                       // Not liked (outline)
        REACTION_BUTTON: 'div[role="button"]:has(svg#thumbs-up-outline-medium)',     // Clickable like container
        REACTION_BUTTON_ACTIVE: 'div[role="button"]:has(svg#like-consumption-medium)', // Already-liked container
        COMMENT_LINK: 'a:has(svg#comment-medium)',                                   // Comment link (opens post)

        // Comment Section (IN NEW TAB - Post Detail Page)
        MY_COMMENT_MARKER: '.comments-comment-meta__data',
        QUICK_REPLY_CONGRATS: 'button[aria-label*="Congratulations"]',
        COMMENT_SUBMIT_BUTTON: '.comments-comment-box__submit-button--cr',

        // Legacy selectors (kept for compatibility)
        LIKE_BUTTON: 'button[aria-label^="React Like"], button[aria-label="Like"]',
        COMMENT_BUTTON: 'button[aria-label^="Comment"]',
        COMMENT_INPUT: 'div[role="textbox"]',
        POST_COMMENT_BUTTON: 'button.comments-comment-box__submit-button',

        // Verification / Success Indicators
        SUCCESS_SIGNAL: 'svg[id="signal-success-small"]',
        MESSAGE_SENT_TEXT: 'p:has-text("Message sent")',
    },

    // Strings to detect
    STRINGS: {
        MESSAGE_SENT: "Message sent",
        BIRTHDAY: "birthday",
        ANNIVERSARY: "anniversary",
        PROMOTION: "new role", // "Congrats on starting your new role..."
    }
};
