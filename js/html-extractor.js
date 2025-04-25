/**
 * HTML Content Extractor for WordPress
 * Extracts relevant content from complex HTML files for WordPress editor
 */

class HtmlExtractor {
    constructor() {
        this.contentSelectors = ['#contents', '.article-content', '.post-content', '.content', 'article', 'main'];
        this.blockElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'ul', 'ol', 'blockquote', 'figure', 'div'];
    }

    /**
     * Extract clean HTML content from a full HTML document
     */
    extractContent(htmlString) {
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        // Remove head, script, style and other unnecessary elements
        this.removeUnnecessaryElements(doc);
        
        // Try to locate the main content area
        const contentElement = this.findContentElement(doc);
        
        if (contentElement) {
            return this.cleanupContent(contentElement);
        } else {
            // If we couldn't find a specific content area, extract content from body
            return this.extractContentFromBody(doc.body);
        }
    }
    
    /**
     * Remove unnecessary elements from the document
     */
    removeUnnecessaryElements(doc) {
        const elementsToRemove = ['script', 'style', 'noscript', 'iframe', 'meta', 'link', 'head'];
        
        elementsToRemove.forEach(tag => {
            const elements = doc.getElementsByTagName(tag);
            for (let i = elements.length - 1; i >= 0; i--) {
                elements[i].parentNode.removeChild(elements[i]);
            }
        });
        
        // Remove comments
        const removeComments = (node) => {
            if (!node) return;
            
            for (let i = node.childNodes.length - 1; i >= 0; i--) {
                const child = node.childNodes[i];
                if (child.nodeType === 8) { // Node.COMMENT_NODE
                    node.removeChild(child);
                } else if (child.nodeType === 1) { // Node.ELEMENT_NODE
                    removeComments(child);
                }
            }
        };
        
        removeComments(doc);
    }
    
    /**
     * Find the main content element in the document
     */
    findContentElement(doc) {
        // Try to find the content by common selectors
        for (const selector of this.contentSelectors) {
            const element = doc.querySelector(selector);
            if (element) return element;
        }
        
        // If we couldn't find by selectors, try other heuristics
        // 1. Find the element with the most paragraph tags
        const paragraphCounts = new Map();
        const elements = doc.querySelectorAll('div, article, section, main');
        
        for (const element of elements) {
            const paragraphs = element.querySelectorAll('p');
            if (paragraphs.length > 3) {
                paragraphCounts.set(element, paragraphs.length);
            }
        }
        
        if (paragraphCounts.size > 0) {
            // Sort by paragraph count and return the element with the most paragraphs
            const [element] = [...paragraphCounts.entries()].sort((a, b) => b[1] - a[1])[0];
            return element;
        }
        
        return null;
    }
    
    /**
     * Clean up the content element
     */
    cleanupContent(element) {
        // Clone the element to avoid modifying the original
        const contentElement = element.cloneNode(true);
        
        // Replace image references with WordPress format
        this.processImages(contentElement);
        
        // Create and return the HTML string
        return contentElement.innerHTML;
    }
    
    /**
     * Extract content directly from body when no specific content container is found
     */
    extractContentFromBody(bodyElement) {
        if (!bodyElement) return '';
        
        const content = document.createElement('div');
        
        // Process each child of the body
        for (const child of Array.from(bodyElement.childNodes)) {
            // Skip empty text nodes
            if (child.nodeType === 3 && child.textContent.trim() === '') continue;
            
            // Skip irrelevant elements
            if (child.nodeType === 1) {
                const tagName = child.tagName.toLowerCase();
                
                // Skip navigation, headers, footers and empty divs
                if (['nav', 'header', 'footer'].includes(tagName)) continue;
                if (tagName === 'div' && !child.textContent.trim()) continue;
                
                // If it's a block element and has content, include it
                if (this.blockElements.includes(tagName) && child.textContent.trim()) {
                    content.appendChild(child.cloneNode(true));
                }
            }
        }
        
        // Process images
        this.processImages(content);
        
        return content.innerHTML;
    }
    
    /**
     * Process images - convert to WordPress format and suggest proper naming
     */
    processImages(element) {
        const images = element.querySelectorAll('img');
        
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const src = img.getAttribute('src');
            
            if (src) {
                const filename = src.split('/').pop().split('?')[0];
                
                // Try to find the image caption
                let caption = '';
                
                // Check if the image is inside a figure with figcaption
                const figure = img.closest('figure');
                if (figure) {
                    const figcaption = figure.querySelector('figcaption');
                    if (figcaption) {
                        caption = figcaption.textContent.trim();
                    }
                }
                
                // If no figcaption, check for an adjacent sibling with caption-like content
                if (!caption) {
                    let next = img.nextElementSibling;
                    if (next && (next.classList.contains('caption') || 
                                next.classList.contains('wp-caption-text') || 
                                next.tagName === 'EM' || 
                                next.tagName === 'I' ||
                                next.style.fontStyle === 'italic')) {
                        caption = next.textContent.trim();
                    }
                }
                
                // Generate a proper alt text
                const alt = img.getAttribute('alt') || caption || filename;
                
                // Create WordPress image HTML
                const wpImage = caption
                    ? `[caption align="aligncenter" width="100%"]<img src="${src}" alt="${alt}" /> ${caption}[/caption]`
                    : `<img src="${src}" alt="${alt}" />`;
                
                // Create a new wrapper element
                const wrapper = document.createElement('div');
                wrapper.innerHTML = wpImage;
                
                // Replace the image with the WordPress formatted version
                if (figure && figure.querySelector('figcaption')) {
                    // Replace the entire figure element
                    figure.parentNode.replaceChild(wrapper, figure);
                } else {
                    // Replace just the image
                    img.parentNode.replaceChild(wrapper, img);
                }
            }
        }
    }
    
    /**
     * Generate a table of contents from HTML headings
     */
    generateTableOfContents(htmlContent) {
        const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
        const headings = doc.querySelectorAll('h2, h3');
        
        if (headings.length <= 1) return ''; // Don't generate TOC for just one heading
        
        let tocHtml = '<div class="content-wrap">\n<h4>Зміст</h4>\n<ol class="nav-items">\n';
        
        Array.from(headings).forEach(heading => {
            const text = heading.textContent.trim();
            const tagName = heading.tagName.toLowerCase();
            const level = parseInt(tagName.substring(1));
            
            // Get or create an id for the heading
            let id = heading.id;
            if (!id) {
                id = text.toLowerCase()
                    .replace(/[^\wа-яґєіїё\s-]/gi, '')
                    .replace(/\s+/g, '-');
                heading.id = id;
            }
            
            const indent = level > 2 ? '\t' : '';
            tocHtml += `${indent}\t<li><a href="#${id}">${text}</a></li>\n`;
        });
        
        tocHtml += '</ol>\n</div>';
        return tocHtml;
    }
    
    /**
     * Process HTML for WordPress
     */
    processHtmlForWordPress(htmlString) {
        // Extract the main content
        const content = this.extractContent(htmlString);
        
        // Generate table of contents
        const toc = this.generateTableOfContents(content);
        
        // Return the combined result
        return toc + '\n\n' + content;
    }
}

// Export for use in browser environment
if (typeof window !== 'undefined') {
    window.HtmlExtractor = HtmlExtractor;
}
