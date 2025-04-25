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
            '.main-content',
            'body'  // Додаємо body для Google Docs HTML
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
            
            // Застосовуємо додаткову очистку для Google Docs HTML
            const extraCleanContent = this.cleanupHtmlForWordPress(cleanContent);
            
            // Генеруємо зміст на основі заголовків
            const toc = this.generateTableOfContents(extraCleanContent);
            
            // Об'єднуємо все
            return toc + '\n\n' + extraCleanContent;
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
        return doc.body;
    }
    
    /**
     * Обробляє контент та зображення
     * @param {Element} element - елемент для обробки
     * @returns {string} - оброблений HTML
     */
    processContent(element) {
        // Створюємо глибоку копію, щоб не змінювати оригінал
        const workingElement = element.cloneNode(true);
        
        // Застосовуємо функцію очистки для Google Docs HTML
        const cleanedElement = this.cleanHtmlForWordPress(workingElement);
        
        // Обробляємо зображення
        this.processImages(cleanedElement);
        
        // Доповнюємо якорі для заголовків
        this.addAnchorsToHeadings(cleanedElement);
        
        // Виправляємо відносні шляхи в посиланнях
        this.fixRelativeLinks(cleanedElement);
        
        // Очищуємо і форматуємо списки
        const cleanedHtml = this.cleanWordPressLists(cleanedElement.innerHTML);
        cleanedElement.innerHTML = cleanedHtml;
        
        // Видаляємо порожні елементи
        this.removeEmptyElements(cleanedElement);
        
        // Повертаємо чистий HTML
        return cleanedElement.innerHTML;
    }
    
    /**
     * Улучшенная функция очистки HTML для WordPress редактора
     * @param {Element} element - HTML элемент для обработки
     * @returns {Element} - очищенный HTML элемент
     */
    cleanHtmlForWordPress(element) {
        if (!element) return element;
        
        // Клонируем элемент для обработки
        const cleanElement = element.cloneNode(true);
        
        // Функция для удаления лишних пробелов и переносов строк
        const removeExtraSpaces = (node) => {
            if (node.nodeType === 3) { // TEXT_NODE
                // Заменяем множественные пробелы и переносы строк на одиночные
                node.textContent = node.textContent
                    .replace(/\s+/g, ' ')
                    .replace(/^\s+|\s+$/g, '');
            } else if (node.nodeType === 1) { // ELEMENT_NODE
                // Обработка блочных элементов - сохраняем один перенос строки
                const isBlockElement = this.blockElements.includes(node.tagName.toLowerCase());
                
                // Перебираем все дочерние узлы
                for (let i = 0; i < node.childNodes.length; i++) {
                    removeExtraSpaces(node.childNodes[i]);
                }
                
                // Для текстовых узлов в блочных элементах добавляем отступы
                if (isBlockElement && node.firstChild && node.firstChild.nodeType === 3) {
                    node.firstChild.textContent = node.firstChild.textContent.trimStart();
                }
                if (isBlockElement && node.lastChild && node.lastChild.nodeType === 3) {
                    node.lastChild.textContent = node.lastChild.textContent.trimEnd();
                }
            }
        };
        
        // Функция для удаления атрибутов стилей и классов
        const removeStyleAttributes = (node) => {
            if (node.nodeType === 1) { // ELEMENT_NODE
                // Список атрибутов для удаления
                const attributesToRemove = ['style', 'class', 'id', 'onclick', 'onload', 'onmouseover', 
                                        'onmouseout', 'data-*', 'aria-*'];
                
                // Сохраняем только важные атрибуты для некоторых тегов
                const preservedAttributes = {
                    'a': ['href', 'target', 'title', 'rel'],
                    'img': ['src', 'alt', 'title', 'width', 'height'],
                    'iframe': ['src', 'width', 'height', 'allowfullscreen'],
                    'video': ['src', 'controls', 'width', 'height'],
                    'audio': ['src', 'controls'],
                    'table': ['width'],
                    'th': ['colspan', 'rowspan'],
                    'td': ['colspan', 'rowspan']
                };
                
                // Получаем список атрибутов для сохранения для текущего тега
                const preserveList = preservedAttributes[node.tagName.toLowerCase()] || [];
                
                // Удаляем все атрибуты, кроме тех, что нужно сохранить
                const attributes = Array.from(node.attributes);
                attributes.forEach(attr => {
                    const attrName = attr.name.toLowerCase();
                    
                    // Проверка на атрибуты для сохранения
                    if (!preserveList.includes(attrName)) {
                        // Проверка на data-* и aria-* атрибуты
                        if (attrName.startsWith('data-') || attrName.startsWith('aria-') || 
                            attrName === 'style' || attrName === 'class' || attrName.startsWith('on')) {
                            node.removeAttribute(attrName);
                        }
                    }
                });
                
                // Обрабатываем все дочерние элементы
                for (let i = 0; i < node.childNodes.length; i++) {
                    removeStyleAttributes(node.childNodes[i]);
                }
            }
        };
        
        // Функция для обработки специфичных для WordPress элементов
        const processWordPressSpecifics = (node) => {
            if (node.nodeType === 1) { // ELEMENT_NODE
                // Конвертация <div> в <p> для улучшения совместимости с редактором WordPress
                if (node.tagName.toLowerCase() === 'div' && 
                    !node.querySelector('div, table, ul, ol, blockquote, h1, h2, h3, h4, h5, h6')) {
                    // Создаем новый p-элемент
                    const newParagraph = document.createElement('p');
                    newParagraph.innerHTML = node.innerHTML;
                    
                    // Заменяем div на p
                    if (node.parentNode) {
                        node.parentNode.replaceChild(newParagraph, node);
                    }
                    
                    // Продолжаем обработку с новым элементом
                    processWordPressSpecifics(newParagraph);
                    return;
                }
                
                // Обрабатываем все дочерние элементы
                for (let i = 0; i < node.childNodes.length; i++) {
                    processWordPressSpecifics(node.childNodes[i]);
                }
            }
        };
        
        // Применяем все функции очистки
        removeExtraSpaces(cleanElement);
        removeStyleAttributes(cleanElement);
        processWordPressSpecifics(cleanElement);
        
        return cleanElement;
    }
    
    /**
     * Очищает HTML от нежелательных элементов и атрибутов для WordPress
     * @param {string} html - HTML содержимое
     * @returns {string} - очищенный HTML
     */
    cleanupHtmlForWordPress(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Список тегов, которые следует сохранить
        const allowedTags = [
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'a', 'strong', 'em', 'b', 'i', 'u', 'strike', 's',
            'blockquote', 'pre', 'code',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'img', 'figure', 'figcaption',
            'div', 'span', 'br', 'hr'
        ];
        
        // Преобразование небезопасных тегов
        const transformUnsafeTags = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Если тег не в списке разрешенных
                if (!allowedTags.includes(node.tagName.toLowerCase())) {
                    // Определяем, как преобразовать тег
                    let newTag;
                    switch (node.tagName.toLowerCase()) {
                        case 'article':
                        case 'section':
                        case 'main':
                        case 'aside':
                        case 'nav':
                        case 'header':
                        case 'footer':
                            newTag = 'div';
                            break;
                        case 'button':
                            newTag = 'span';
                            break;
                        default:
                            newTag = 'p'; // По умолчанию преобразуем в параграф
                    }
                    
                    // Создаем новый элемент и переносим содержимое
                    const newElement = document.createElement(newTag);
                    while (node.firstChild) {
                        newElement.appendChild(node.firstChild);
                    }
                    
                    // Заменяем оригинальный элемент новым
                    node.parentNode.replaceChild(newElement, node);
                    
                    // Продолжаем обработку с новым элементом
                    transformUnsafeTags(newElement);
                    return;
                }
                
                // Рекурсивно обрабатываем дочерние элементы
                const childNodes = Array.from(node.childNodes);
                childNodes.forEach(child => transformUnsafeTags(child));
            }
        };
        
        // Очистка атрибутов, сохраняя только нужные
        const cleanupAttributes = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Список разрешенных атрибутов для каждого тега
                const allowedAttrs = {
                    'a': ['href', 'target', 'rel', 'title'],
                    'img': ['src', 'alt', 'width', 'height', 'class'],
                    'table': ['width'],
                    'th': ['colspan', 'rowspan', 'scope'],
                    'td': ['colspan', 'rowspan'],
                    'div': ['class', 'id'],
                    'span': ['class'],
                    'h1': ['id'], 'h2': ['id'], 'h3': ['id'], 'h4': ['id'], 'h5': ['id'], 'h6': ['id']
                };
                
                // Получаем список разрешенных атрибутов для данного тега
                const tagName = node.tagName.toLowerCase();
                const allowList = allowedAttrs[tagName] || [];
                
                // Удаляем все атрибуты, кроме разрешенных
                Array.from(node.attributes).forEach(attr => {
                    if (!allowList.includes(attr.name.toLowerCase())) {
                        node.removeAttribute(attr.name);
                    }
                });
                
                // Особые случаи для определенных тегов
                if (tagName === 'a') {
                    // Добавляем rel="noopener" для внешних ссылок
                    const href = node.getAttribute('href');
                    if (href && (href.startsWith('http') || href.startsWith('//'))) {
                        if (!node.getAttribute('target')) {
                            node.setAttribute('target', '_blank');
                        }
                        node.setAttribute('rel', 'noopener');
                    }
                } else if (tagName === 'img') {
                    // Гарантируем, что у всех изображений есть alt-атрибут
                    if (!node.hasAttribute('alt')) {
                        node.setAttribute('alt', '');
                    }
                }
                
                // Обрабатываем дочерние элементы
                Array.from(node.childNodes).forEach(child => {
                    cleanupAttributes(child);
                });
            }
        };
        
        // Удаление пустых элементов
        const removeEmptyElements = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Сначала обрабатываем дочерние элементы (снизу вверх)
                const children = Array.from(node.childNodes);
                children.forEach(child => removeEmptyElements(child));
                
                // Пропускаем элементы, которые могут быть пустыми
                const canBeEmpty = ['br', 'hr', 'img', 'input'];
                if (!canBeEmpty.includes(node.tagName.toLowerCase())) {
                    // Проверяем, если элемент пустой
                    const isEmpty = node.textContent.trim() === '' && 
                                !node.querySelector('img, input, br, hr') &&
                                node.children.length === 0;
                                
                    if (isEmpty && node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                }
            }
        };
        
        // Исправление структуры списков и таблиц
        const fixStructure = (doc) => {
            // Исправление списков
            const fixLists = () => {
                const listItems = doc.querySelectorAll('li');
                listItems.forEach(li => {
                    // Убедимся, что элемент списка находится внутри списка
                    if (li.parentNode && !['ul', 'ol'].includes(li.parentNode.tagName.toLowerCase())) {
                        // Создаем новый список
                        const list = document.createElement('ul');
                        // Находим все соседние li
                        const siblings = [];
                        let currentNode = li;
                        
                        while (currentNode) {
                            if (currentNode.tagName && currentNode.tagName.toLowerCase() === 'li') {
                                siblings.push(currentNode);
                            }
                            currentNode = currentNode.nextSibling;
                        }
                        
                        // Добавляем все li в новый список
                        siblings.forEach(sibling => {
                            list.appendChild(sibling);
                        });
                        
                        // Вставляем список на место первого li
                        li.parentNode.insertBefore(list, li);
                    }
                });
            };
            
            // Исправление таблиц
            const fixTables = () => {
                const tables = doc.querySelectorAll('table');
                tables.forEach(table => {
                    // Убедимся, что таблица имеет тело
                    if (!table.querySelector('tbody')) {
                        const rows = table.querySelectorAll('tr');
                        if (rows.length > 0) {
                            // Создаем tbody
                            const tbody = document.createElement('tbody');
                            
                            // Перемещаем строки в tbody
                            rows.forEach(row => {
                                if (!row.parentNode || row.parentNode.tagName.toLowerCase() !== 'thead') {
                                    tbody.appendChild(row);
                                }
                            });
                            
                            // Добавляем tbody в таблицу
                            table.appendChild(tbody);
                        }
                    }
                    
                    // Удаляем атрибуты стилей из таблицы
                    table.removeAttribute('style');
                    table.removeAttribute('border');
                    table.removeAttribute('cellspacing');
                    table.removeAttribute('cellpadding');
                    
                    // Добавляем класс WordPress-таблицы
                    table.setAttribute('class', 'wp-table');
                });
            };
            
            fixLists();
            fixTables();
        };
        
        // Применяем все функции очистки
        transformUnsafeTags(doc.body);
        cleanupAttributes(doc.body);
        removeEmptyElements(doc.body);
        fixStructure(doc);
        
        // Возвращаем очищенный HTML
        return doc.body.innerHTML;
    }
    
    /**
     * Обрабатывает зображення и форматирует их в WordPress-стиле
     * @param {Element} element - элемент с изображениями
     */
    processImages(element) {
        const images = element.querySelectorAll('img');
        
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const src = img.getAttribute('src');
            
            if (src) {
                // Исправляем относительные пути
                if (src.startsWith('/') || (!src.startsWith('http') && !src.startsWith('//'))) {
                    img.setAttribute('src', this.resolveRelativePath(src));
                }
                
                // Находим подпись к изображению
                let caption = '';
                let figureElement = null;
                
                // Проверяем подпись в figure/figcaption
                const figure = img.closest('figure');
                if (figure) {
                    figureElement = figure;
                    const figcaption = figure.querySelector('figcaption');
                    if (figcaption) {
                        caption = figcaption.textContent.trim();
                    }
                }
                
                // Или проверяем alt и title атрибуты
                if (!caption) {
                    const altText = img.getAttribute('alt') || '';
                    const titleText = img.getAttribute('title') || '';
                    
                    // Используем alt или title, если они не являются общими словами "image", "фото" и т.д.
                    const genericTerms = ['image', 'picture', 'photo', 'фото', 'изображение', 'картинка'];
                    
                    if (altText && !genericTerms.includes(altText.toLowerCase().trim())) {
                        caption = altText;
                    } else if (titleText && !genericTerms.includes(titleText.toLowerCase().trim())) {
                        caption = titleText;
                    }
                }
                
                // Добавляем alt-атрибут, если нет
                if (!img.hasAttribute('alt')) {
                    img.setAttribute('alt', caption || `Image ${i+1}`);
                } else if (img.getAttribute('alt').trim() === '') {
                    // Убедимся, что alt не пустой
                    img.setAttribute('alt', caption || `Image ${i+1}`);
                }
                
                // Удаляем ненужные атрибуты, оставляем только необходимые
                const validAttributes = ['src', 'alt', 'width', 'height'];
                Array.from(img.attributes).forEach(attr => {
                    if (!validAttributes.includes(attr.name)) {
                        img.removeAttribute(attr.name);
                    }
                });
                
                // Обеспечиваем адаптивность изображений для WordPress
                if (img.hasAttribute('width') && img.hasAttribute('height')) {
                    const width = parseInt(img.getAttribute('width'));
                    const height = parseInt(img.getAttribute('height'));
                    
                    if (width > 1200) {
                        const ratio = height / width;
                        img.setAttribute('width', '1200');
                        img.setAttribute('height', Math.round(1200 * ratio));
                    }
                }
                
                // Преобразуем в WordPress формат с подписью
                if (caption && figureElement) {
                    // Создаем WordPress-шорткод с выравниванием по центру
                    const wpImage = document.createElement('div');
                    wpImage.innerHTML = `[caption id="" align="aligncenter" width="100%"]<img src="${img.getAttribute('src')}" alt="${img.getAttribute('alt')}" ${img.hasAttribute('width') ? 'width="'+img.getAttribute('width')+'"' : ''} ${img.hasAttribute('height') ? 'height="'+img.getAttribute('height')+'"' : ''} class="size-full" /> ${caption}[/caption]`;
                    
                    // Заменяем figure на div с шорткодом
                    if (figureElement.parentNode) {
                        figureElement.parentNode.replaceChild(wpImage, figureElement);
                    }
                } else if (caption) {
                    // Если есть подпись, но нет figure - оборачиваем изображение в шорткод
                    const wpImage = document.createElement('div');
                    wpImage.innerHTML = `[caption id="" align="aligncenter" width="100%"]<img src="${img.getAttribute('src')}" alt="${img.getAttribute('alt')}" ${img.hasAttribute('width') ? 'width="'+img.getAttribute('width')+'"' : ''} ${img.hasAttribute('height') ? 'height="'+img.getAttribute('height')+'"' : ''} class="size-full" /> ${caption}[/caption]`;
                    
                    // Заменяем img на div с шорткодом
                    if (img.parentNode) {
                        img.parentNode.replaceChild(wpImage, img);
                    }
                } else {
                    // Если нет подписи, добавляем класс выравнивания по центру
                    img.setAttribute('class', 'aligncenter size-full');
                    
                    // Оборачиваем в div для лучшей совместимости с WP
                    const imgWrapper = document.createElement('div');
                    imgWrapper.className = 'wp-image-container';
                    imgWrapper.appendChild(img.cloneNode(true));
                    
                    if (img.parentNode) {
                        img.parentNode.replaceChild(imgWrapper, img);
                    }
                }
