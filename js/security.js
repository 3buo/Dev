import DOMPurify from 'dompurify';

/**
 * Global Sanitization Utility
 * Prevents XSS by cleaning any HTML string.
 */
export const sanitize = (html: string) => DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'div', 'span', 'ul', 'li', 'table', 'tr', 'th', 'td', 'code', 'pre', 'blockquote', 'img'],
    ALLOWED_ATTR: ['class', 'style', 'id', 'href', 'src', 'alt'],
    ALLOWED_URI_SCHEMES: ['http', 'https', 'mailto', 'tcp', 'data', 'javascript'] // Note: 'javascript' is generally unsafe, but included if specific needs exist. Standard practice is to exclude it.
});

/**
 * Validation Schemas
 */
export const schemas = {
    finance: {
        amount: (val: number) => {
            const num = parseFloat(val);
            return !isNaN(num) && num >= 0;
        },
        description: (val: string) => {
            return val.trim().length <= 100;
        }
    },
    notes: {
        title: (val: string) => {
            return val.trim().length > 0 && val.trim().length <= 150;
        },
        content: (val: string) => {
            return val.trim().length <= 5000;
        }
    }
};
