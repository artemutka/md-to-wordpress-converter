/**
 * Специальная функция для очистки HTML экспортированного из Google Docs
 * @param {string} html - HTML-контент из Google Docs
 * @returns {string} - Очищенный HTML
 */
function cleanGoogleDocsHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 1. Удаляем все стили
    const style = doc.querySelectorAll('style');
    style.forEach(el => el.parentNode.removeChild(el));
    
    // 2. Удаляем все классы и стили из элементов
    function removeAttributes(element) {
        if (!element) return;
        
        // Список атрибутов, которые нужно сохранить
        const keepAttributes = {
            'a': ['href', 'target', 'title'],
            'img': ['src', 'alt', 'width', 'height'],
            'table': ['width'],
            'th': ['colspan', 'rowspan'],
            'td': ['colspan', 'rowspan'],
            'h1': ['id'],
            'h2': ['id'],
            'h3': ['id'],
            'h4': ['id'],
            'h5': ['id'],
            'h6': ['id']
        };
        
        Array.from(element.children).forEach(child => {
            // Сохраняем только нужные атрибуты для определенных тегов
            const tagName = child.tagName.toLowerCase();
            const preservedAttrs = keepAttributes[tagName] || [];
            
            // Удаляем все атрибуты
            const attributes = [...child.attributes];
            attributes.forEach(attr => {
                // Не удаляем атрибуты из списка сохраняемых
                if (!preservedAttrs.includes(attr.name)) {
                    child.removeAttribute(attr.name);
                }
            });
            
            // Обрабатываем вложенные элементы
            removeAttributes(child);
        });
    }
    
    removeAttributes(doc.body);
    
    // 3. Обработка изображений
    const images = doc.querySelectorAll('img');
    images.forEach(img => {
        // Чистим атрибуты img, оставляем только src, alt и размеры
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt') || '';
        
        // Сохраняем размеры, если они есть
        const width = img.getAttribute('width') || img.style.width || '';
        const height = img.getAttribute('height') || img.style.height || '';
        
        // Удаляем все атрибуты и устанавливаем только нужные
        while (img.attributes.length > 0) {
            img.removeAttribute(img.attributes[0].name);
        }
        
        img.setAttribute('src', src);
        img.setAttribute('alt', alt);
        
        if (width) img.setAttribute('width', width.replace('px', ''));
        if (height) img.setAttribute('height', height.replace('px', ''));
    });
    
    // 4. Чистим специфичные элементы Google Docs
    
    // 4.1 Преобразуем span с list-стилями в реальные списки
    const convertGoogleDocLists = () => {
        // Находим все span с Google Docs классами списков
        const potentialListItems = Array.from(doc.querySelectorAll('.lst-kix_list'));
        
        if (potentialListItems.length > 0) {
            // Создаем новые списки
            let currentList = null;
            let currentLevel = 0;
            
            potentialListItems.forEach(item => {
                // Если это первый элемент или новый уровень
                if (!currentList) {
                    currentList = doc.createElement('ul');
                    
                    // Вставляем список перед текущим элементом
                    item.parentNode.insertBefore(currentList, item);
                }
                
                // Создаем элемент списка
                const li = doc.createElement('li');
                li.innerHTML = item.innerHTML;
                
                // Добавляем в список
                currentList.appendChild(li);
                
                // Удаляем оригинальный элемент
                item.parentNode.removeChild(item);
            });
        }
    };
    
    convertGoogleDocLists();
    
    // 4.2 Обработка таблиц - удаляем лишнее форматирование
    const tables = doc.querySelectorAll('table');
    tables.forEach(table => {
        // Удаляем все классы и стили таблицы
        table.removeAttribute('class');
        table.removeAttribute('style');
        
        // Добавляем стандартный класс WordPress
        table.setAttribute('class', 'wp-table');
        
        // Обрабатываем ячейки
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
            // Сохраняем только colspan и rowspan
            const colspan = cell.getAttribute('colspan');
            const rowspan = cell.getAttribute('rowspan');
            
            // Очищаем все атрибуты
            while (cell.attributes.length > 0) {
                cell.removeAttribute(cell.attributes[0].name);
            }
            
            // Возвращаем сохраненные атрибуты
            if (colspan) cell.setAttribute('colspan', colspan);
            if (rowspan) cell.setAttribute('rowspan', rowspan);
        });
    });
    
    // 5. Преобразование структуры заголовков
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
        // Создаем идентификатор на основе текста заголовка
        const headingText = heading.textContent.trim();
        if (headingText && !heading.id) {
            const id = headingText
                .toLowerCase()
                .replace(/[^a-zа-яёіїєґ0-9\s-]/g, '')
                .replace(/\s+/g, '-');
            
            heading.setAttribute('id', id);
        }
    });
    
    // 6. Очистка параграфов от вложенных div, span и других лишних элементов
    const paragraphs = doc.querySelectorAll('p');
    paragraphs.forEach(p => {
        // Сохраняем текст и изображения
        const html = p.innerHTML;
        
        // Очищаем параграф от всех атрибутов
        while (p.attributes.length > 0) {
            p.removeAttribute(p.attributes[0].name);
        }
        
        // Возвращаем содержимое
        p.innerHTML = html;
    });
    
    // 7. Удаление пустых элементов
    const removeEmptyElements = (container) => {
        const emptyElements = container.querySelectorAll('p, div, span');
        let removedCount = 0;
        
        emptyElements.forEach(el => {
            if (!el.textContent.trim() && !el.querySelector('img, iframe, video')) {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                    removedCount++;
                }
            }
        });
        
        // Продолжаем удалять пустые элементы, пока они есть
        if (removedCount > 0) {
            removeEmptyElements(container);
        }
    };
    
    removeEmptyElements(doc.body);
    
    // 8. Замена множественных пробелов и переносов строк
    const normalizeWhitespace = (element) => {
        if (!element) return;
        
        // Обрабатываем текстовые узлы
        if (element.nodeType === Node.TEXT_NODE) {
            element.textContent = element.textContent
                .replace(/\s+/g, ' ')
                .replace(/^\s+|\s+$/g, '');
        }
        
        // Рекурсивно обрабатываем дочерние элементы
        if (element.childNodes && element.childNodes.length > 0) {
            for (let i = 0; i < element.childNodes.length; i++) {
                normalizeWhitespace(element.childNodes[i]);
            }
        }
    };
    
    normalizeWhitespace(doc.body);
    
    // 9. Добавление подписей к изображениям
    const processImageCaptions = () => {
        // Ищем все изображения
        const images = doc.querySelectorAll('img');
        
        images.forEach(img => {
            // Проверяем элемент после изображения
            let captionEl = null;
            let nextEl = img.parentNode.nextElementSibling;
            
            // Проверяем следующий элемент на наличие класса c8 или текста, похожего на подпись
            if (nextEl && (
                nextEl.className.includes('c8') || 
                nextEl.className.includes('caption') || 
                nextEl.textContent.trim().startsWith('Рис.') || 
                nextEl.textContent.trim().startsWith('Фото') ||
                nextEl.textContent.trim().startsWith('Изображение') ||
                nextEl.textContent.trim().startsWith('Image')
            )) {
                captionEl = nextEl;
                
                // Создаем WordPress-совместимую подпись
                const caption = captionEl.textContent.trim();
                const wpImage = doc.createElement('div');
                wpImage.innerHTML = `[caption align="aligncenter" width="100%"]<img src="${img.getAttribute('src')}" alt="${caption}" ${img.hasAttribute('width') ? 'width="'+img.getAttribute('width')+'"' : ''} ${img.hasAttribute('height') ? 'height="'+img.getAttribute('height')+'"' : ''} /> ${caption}[/caption]`;
                
                // Заменяем изображение на изображение с подписью
                img.parentNode.replaceChild(wpImage, img);
                
                // Удаляем элемент с подписью, так как он теперь внутри caption
                captionEl.parentNode.removeChild(captionEl);
            }
        });
    };
    
    processImageCaptions();
    
    // 10. Обработка заголовков из Google Docs для корректного оглавления
    function cleanGoogleDocsHeadings() {
        // Находим все заголовки с идентификаторами h.XXX
        const headings = doc.querySelectorAll('h1[id^="h."], h2[id^="h."], h3[id^="h."], h4[id^="h."], h5[id^="h."], h6[id^="h."]');
        
        headings.forEach(heading => {
            // Создаем более читабельный идентификатор из текста заголовка
            const text = heading.textContent.trim();
            const newId = text
                .toLowerCase()
                .replace(/[^a-zа-яёіїєґ0-9\s-]/g, '')
                .replace(/\s+/g, '-');
            
            // Устанавливаем новый идентификатор
            heading.id = newId;
        });
    }
    
    cleanGoogleDocsHeadings();
    
    return doc.body.innerHTML;
}
