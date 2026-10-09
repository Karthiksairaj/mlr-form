$(function () {
    if ($('.cmp-formsembed-widget').length) {
        abbvFormsEmbed.showLoader();
        abbvFormsEmbed.init();
    }
});

var abbvFormsEmbed = (function () {
    var loadedCount = 0;
    var $widgets = $('.forms-embed .cmp-formsembed-widget');
    var $globalLoader = $widgets.first().find('.cmp-adaptiveform-container-form-loading');
    return {
        init: function () {
            $('.cmp-formsembed-widget').each(function (index) {
                var formsUrl = this.dataset.formsUrl;
                var options = { path: formsUrl, CSS_Selector: ".afsection" };
                if (options.path) {
                    abbvFormsEmbed.fetchData(options, index);
                } else {
                    if (typeof console !== "undefined") {
                        console.log("Path of Adaptive Form not specified to loadAdaptiveForm");
                    }
                }
            });
        },

        fetchData: async function (options, index) {
            try {
                const response = await fetch(options.path, { method: 'GET' });
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.text();
                var element = document.querySelectorAll('.afsection')[index];
                if (element) {
                    abbvFormsEmbed.updateElementContent(element, data, index);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        },
        showLoader: function () {
            $('.cmp-adaptiveform-container-form-loading').not($globalLoader).hide();
            $globalLoader.show();
        },
        hideLoader: function () {
            $globalLoader.hide();
        },

        updateElementContent: function (targetElement, newHtml, index) {
            try {
                targetElement.innerHTML = newHtml;
                const scripts = targetElement.querySelectorAll('script');
                Array.from(scripts).forEach(oldScriptElement => {
                    const newScriptElement = document.createElement("script");
                    Array.from(oldScriptElement.attributes).forEach(attribute => {
                        newScriptElement.setAttribute(attribute.name, attribute.value);
                    });
                    const scriptText = document.createTextNode(oldScriptElement.innerHTML);
                    newScriptElement.appendChild(scriptText);
                    oldScriptElement.parentNode.replaceChild(newScriptElement, oldScriptElement);
                    newScriptElement.onload = () => {
                        loadedCount++;
                        if (loadedCount === scripts.length) {
                            abbvFormsEmbed.hideLoader();
                        }
                    };
                });
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }
    };
})();