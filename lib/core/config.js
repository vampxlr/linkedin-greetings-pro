module.exports = {
    // Bot Behavior
    DRY_RUN: false, // Set to true to verify logic without clicking "Send"
    SCROLL_VARIANCE: 50, // Pixels to vary when scrolling
    ACTION_DELAY: { min: 5000, max: 10000 },
    BETWEEN_CARDS_DELAY: { min: 10000, max: 15000 }, // Wait time after processing one person before moving to next

    // Selectors derived from prompt.txt and analysis
    SELECTORS: {
        // Main Catch Up List
        CATCH_UP_CONTAINER: 'div.scaffold-finite-scroll__content',
        PROFILE_CARD: 'div[data-view-name="nurture-card"]',

        // Within a Card - STABLE SELECTORS (not using auto-generated class names)
        // Name can be extracted from profile picture's aria-label: "Name's profile picture"
        PROFILE_FIGURE: '[data-view-name="nurture-card-profile-view"] figure[data-view-name="image"]',
        // Three-dots menu is a stable anchor - subtitle is in its parent container
        THREE_DOTS_MENU: '[data-view-name="nurture-card-three-dots-menu"]',
        // Fallback: first two <p> elements in the header section (near three-dots menu)
        REPLY_BUTTON: 'button[aria-label^="Reply to"], button[data-control-name="reply"]',
        DISMISS_BUTTON: 'button[aria-label="Dismiss"]', // To clear processed cards?

        // The "Message" button on the card (if distinct from Reply)
        MESSAGE_BUTTON: 'a[href^="/messaging/compose"], button[aria-label^="Message"]',

        // Quick Reply Chips (when Detail View is open or inline)
        QUICK_REPLY_CHIP: 'button.msg-form__quick-reply-chip',

        // Messaging Overlay
        OVERLAY_CONTAINER: 'div.msg-overlay-conversation-bubble',
        OVERLAY_CLOSE_BUTTON: 'button.msg-overlay-bubble-header__control', // Updated: Removed --close-btn suffix
        MESSAGE_LIST: 'ul.msg-s-message-list',
        MY_MESSAGE: 'li.msg-s-message-list__event--mine', // Check for previous messages

        // Post Interaction (Likes/Comments) - ON CATCH UP CARD
        LIKE_BUTTON_ACTIVE: 'svg#like-consumption-medium',      // Already liked (blue filled)
        LIKE_BUTTON_INACTIVE: 'svg#thumbs-up-outline-medium',   // Not liked (outline)
        REACTION_BUTTON: '[data-view-name="reaction-button"]',  // Clickable container for like
        COMMENT_LINK: '[data-view-name="nurture-card-comment-button"]', // Opens post in new tab

        // Comment Section (IN NEW TAB - Post Detail Page)
        MY_COMMENT_MARKER: '.comments-comment-meta__data',      // Contains "• You" if my comment
        QUICK_REPLY_CONGRATS: 'button[aria-label*="Congratulations"]', // Quick reply chip
        COMMENT_SUBMIT_BUTTON: '.comments-comment-box__submit-button--cr', // Submit button

        // Legacy selectors (kept for compatibility)
        LIKE_BUTTON: 'button[aria-label^="React Like"], button[aria-label="Like"]',
        COMMENT_BUTTON: 'button[aria-label^="Comment"]',
        COMMENT_INPUT: 'div.msg-form__contenteditable[role="textbox"]',
        POST_COMMENT_BUTTON: 'button.comments-comment-box__submit-button',

        // Verification / Success Indicators
        SUCCESS_SIGNAL: 'svg[id="signal-success-small"]', // "Message sent" icon
        MESSAGE_SENT_TEXT: 'p:has-text("Message sent")',
    },

    // Strings to detect
    STRINGS: {
        MESSAGE_SENT: "Message sent",
        BIRTHDAY: "birthday",
        ANNIVERSARY: "anniversary",
    }
};
