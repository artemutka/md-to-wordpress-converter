/**
 * HTML Content Extractor for WordPress
 * Improved version with better content extraction and image processing
 */

class HtmlExtractor {
    constructor() {
        // Основні селектори для пошуку основного контенту
        this.contentSelectors = [
            'article', 
            'main', 
            '.content', 
            '.post-content', 
            '.article-content', 
            '#content', 
            '.entry-content',
            '.post',
            '.article',
            '#main-content',
            '.main-content'
        ];
        
        // Елементи, які слід видалити з контенту
        this.elementsToRemove = [
            'script', 
            'style', 
            'noscript', 
            'iframe', 
            'header', 
            'footer', 
            'nav', 
            'aside', 
            '.sidebar', 
            '.comments', 
            '.advertisement',
            '.ads',
            '.share-buttons',
            '.social-share',
            '.menu',
            '.related-posts',
            '.author-info',
            '.post-meta',
            '.navigation',
            '.pagination'
        ];
        
        // Блокові елементи, які можуть містити корисний контент
        this.blockElements = [
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
            'table', 'ul', 'ol', 'blockquote', 'figure', 
            'div', 'section', 'article', 'aside', 'details', 
            'figcaption', 'pre', 'dl', 'hr'
        ];
        
        // Базова URL для виправлення відносних шляхів
        this.baseUrl = 'https://xgate.dental';
    }

    /**
     * Обробляє HTML для WordPress 
     * @param {string} htmlString - вхідний HTML документ
     * @returns {string} - оброблений HTML для WordPress
     */
    processHtmlForWordPress(htmlString) {
        try {
            // Очищуємо HTML від непотрібних елементів
            const cleanContent = this.extractContent(htmlString);
            
            // Генеруємо зміст на основі заголовків
            const toc = this.generateTableOfContents(cleanContent);
            
            // Об'єднуємо все
            return toc + '\n\n' + cleanContent;
        } catch (error) {
            console.error('Помилка обробки HTML:', error);
            return htmlString; // У випадку помилки, повертаємо оригінальний HTML
        }
    }

    /**
     * Витягує корисний контент з HTML
     * @param {string} htmlString - вхідний HTML
     * @returns {string} - очищений HTML
     */
    extractContent(htmlString) {
        // Парсимо HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        // Видаляємо непотрібні елементи
        this.removeUnnecessaryElements(doc);
        
        // Шукаємо основний контейнер контенту
        const contentElement = this.findContentElement(doc);
        
        if (contentElement) {
            // Обробляємо контент і зображення
            return this.processContent(contentElement);
        } else {
            // Якщо не вдалося знайти основний контейнер, 
            // обробляємо все тіло документа
            return this.processContent(doc.body);
        }
    }
    
    /**
     * Видаляє службові/непотрібні елементи з HTML
     * @param {Document} doc - HTML документ
     */
    removeUnnecessaryElements(doc) {
        // Видаляємо елементи за тегами
        const basicElementsToRemove = ['script', 'style', 'noscript', 'iframe', 'meta', 'link', 'head'];
        basicElementsToRemove.forEach(tag => {
            const elements = doc.getElementsByTagName(tag);
            for (let i = elements.length - 1; i >= 0; i--) {
                if (elements[i].parentNode) {
                    elements[i].parentNode.removeChild(elements[i]);
                }
            }
        });
        
        // Видаляємо елементи за складнішими селекторами
        this.elementsToRemove.forEach(selector => {
            try {
                const elements = doc.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                });
            } catch (e) {
                // Ігноруємо помилки з невалідними селекторами
            }
        });
        
        // Видаляємо коментарі
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
     * Шукає основний контейнер з контентом
     * @param {Document} doc - HTML документ
     * @returns {Element|null} - знайдений елемент або null
     */
    findContentElement(doc) {
        // Спочатку шукаємо за стандартними селекторами
        for (const selector of this.contentSelectors) {
            try {
                const element = doc.querySelector(selector);
                if (element) return element;
            } catch (e) {
                // Ігноруємо невалідні селектори
            }
        }
        
        // Якщо стандартні селектори не спрацювали,
        // шукаємо за евристиками
        
        // 1. Знаходимо елемент з найбільшою кількістю абзаців
        const candidates = doc.querySelectorAll('div, article, section, main');
        let bestElement = null;
        let maxParagraphs = 3; // Мінімальний поріг
        
        for (const element of candidates) {
            const paragraphs = element.querySelectorAll('p');
            if (paragraphs.length > maxParagraphs) {
                maxParagraphs = paragraphs.length;
                bestElement = element;
            }
        }
        
        // 2. Якщо знайшли елемент з достатньою кількістю абзаців
        if (bestElement) {
            return bestElement;
        }
        
        // 3. Пошук за співвідношенням тексту до HTML
        let bestRatio = 0;
        let bestRatioElement = null;
        
        for (const element of candidates) {
            if (element.textContent && element.textContent.trim()) {
                const textLength = element.textContent.trim().length;
                const htmlLength = element.innerHTML.length;
                
                if (htmlLength > 0) {
                    const ratio = textLength / htmlLength;
                    if (ratio > bestRatio) {
                        bestRatio = ratio;
                        bestRatioElement = element;
                    }
                }
            }
        }
        
        if (bestRatioElement && bestRatio > 0.3) { // Евристичний поріг
            return bestRatioElement;
        }
        
        // Якщо не знайшли жодного підходящого елемента
        return null;
    }
    
    /**
     * Обробляє контент та зображення
     * @param {Element} element - елемент для обробки
     * @returns {string} - оброблений HTML
     */
    processContent(element) {
        // Створюємо глибоку копію, щоб не змінювати оригінал
        const workingElement = element.cloneNode(true);
        
        // Обробляємо зображення
        this.processImages(workingElement);
        
        // Доповнюємо якорі для заголовків
        this.addAnchorsToHeadings(workingElement);
        
        // Виправляємо відносні шляхи в посиланнях
        this.fixRelativeLinks(workingElement);
        
        // Видаляємо порожні елементи
        this.removeEmptyElements(workingElement);
        
        // Повертаємо чистий HTML
        return workingElement.innerHTML;
    }
    
    /**
     * Обробляє зображення і форматує їх у WordPress-стилі
     * @param {Element} element - елемент з зображеннями
     */
    processImages(element) {
        const images = element.querySelectorAll('img');
        
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const src = img.getAttribute('src');
            
            if (src) {
                // Виправляємо відносні шляхи
                if (src.startsWith('/') || (!src.startsWith('http') && !src.startsWith('//'))) {
                    img.setAttribute('src', this.resolveRelativePath(src));
                }
                
                // Знаходимо підпис до зображення
                let caption = '';
                
                // Перевіряємо підпис у figure/figcaption
                const figure = img.closest('figure');
                if (figure) {
                    const figcaption = figure.querySelector('figcaption');
                    if (figcaption) {
                        caption = figcaption.textContent.trim();
                    }
                }
                
                // Або перевіряємо alt і title атрибути
                if (!caption) {
                    caption = img.getAttribute('alt') || img.getAttribute('title') || '';
                }
                
                // Додаємо alt-атрибут, якщо немає
                if (!img.hasAttribute('alt')) {
                    img.setAttribute('alt', caption || `Image ${i+1}`);
                }
                
                // Перетворюємо на WordPress формат із підписом, якщо є
                if (caption && figure) {
                    const wpImage = document.createElement('div');
                    wpImage.innerHTML = `[caption align="aligncenter" width="100%"]<img src="${img.getAttribute('src')}" alt="${img.getAttribute('alt')}" /> ${caption}[/caption]`;
                    figure.parentNode.replaceChild(wpImage, figure);
                }
            }
        }
    }
    
    /**
     * Додає якорі до заголовків для навігації
     * @param {Element} element - елемент з заголовками
     */
    addAnchorsToHeadings(element) {
        const headings = element.querySelectorAll('h2, h3');
        
        headings.forEach(heading => {
            // Якщо заголовок ще не має id
            if (!heading.id) {
                const text = heading.textContent.trim();
                const anchor = text.toLowerCase()
                    .replace(/[^\wа-яґєіїё\s-]/gi, '')
                    .replace(/\s+/g, '-');
                
                heading.id = anchor;
            }
        });
    }
    
    /**
     * Виправляє відносні шляхи у посиланнях
     * @param {Element} element - елемент з посиланнями
     */
    fixRelativeLinks(element) {
        const links = element.querySelectorAll('a');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            
            if (href && (href.startsWith('/') || (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')))) {
                link.setAttribute('href', this.resolveRelativePath(href));
            }
        });
    }
    
    /**
     * Перетворює відносний шлях на абсолютний
     * @param {string} path - відносний шлях
     * @returns {string} - абсолютний шлях
     */
    resolveRelativePath(path) {
        if (path.startsWith('/')) {
            return `${this.baseUrl}${path}`;
        } else {
            return `${this.baseUrl}/${path}`;
        }
    }
    
    /**
     * Видаляє порожні елементи
     * @param {Element} element - елемент для очищення
     */
    removeEmptyElements(element) {
        const emptyElements = element.querySelectorAll('p, div, span');
        
        emptyElements.forEach(el => {
            if (!el.textContent.trim() && !el.querySelector('img, iframe, video, audio, canvas')) {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            }
        });
    }
    
    /**
     * Генерує таблицю змісту на основі заголовків
     * @param {string} html - HTML контент
     * @returns {string} - HTML таблиці змісту
     */
    generateTableOfContents(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const headings = doc.querySelectorAll('h2, h3');
        
        if (headings.length <= 1) {
            return ''; // Не створюємо зміст для одного заголовка
        }
        
        let tocHtml = '<div class="content-wrap">\n<h4>Зміст</h4>\n<ol class="nav-items">\n';
        
        headings.forEach(heading => {
            const text = heading.textContent.trim();
            const level = parseInt(heading.tagName.substring(1));
            
            // Створюємо або отримуємо якір
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
}

// Експортуємо для використання у браузері
if (typeof window !== 'undefined') {
    window.HtmlExtractor = HtmlExtractor;
}