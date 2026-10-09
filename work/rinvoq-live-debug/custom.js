/**
 * onSubmit
 * @name onSubmit
 * @param {scope} globals
 */
function onSubmit(globals) {
    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}


/**
 * onSubmitWithCampaignFilterInPayload
 * @name onSubmitWithCampaignFilterInPayload
 * @param {scope} globals
 */
function onSubmitWithCampaignFilterInPayload(globals) {
    var formData = globals.functions.exportData();
    const assessmentQuestionsArray = formData.SaveAssessmentContent.AssessmentQuestion;
    const filteredassessmentQuestionsArray = assessmentQuestionsArray.filter(assessmentQuestion => assessmentQuestion.QuestionOptions[0].OptionId !== undefined);
    formData.SaveAssessmentContent.AssessmentQuestion = filteredassessmentQuestionsArray;
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}

function setCorrelationIdCookie() {
    let formProperties = window.abbviecloudforms.core.formProperties;
    if (formProperties) {
        let correlationName = formProperties.corelationname || '';
        let correlationStart = formProperties.correlationstart || '';
        if (correlationName && correlationStart) {
            setCookie(correlationName.trim().toLowerCase().replace(/ /g, "-"), generateUUID(), false, 31536000);
        }
    }
}

/**
 * customSubmitSuccessHandler
 * @name customSubmitSuccessHandler
 * @param {scope} globals
 */
function customSubmitSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    var response = globals.event.payload.body;
    if (response && response.redirectUrl) {
        redirectToThankYouPage(response.redirectUrl);
    } else {
        console.error("No redirect URL found in the response.");
    }
}

/**
 * customSubmitSuccessHandlerOpenModal
 * @name customSubmitSuccessHandlerOpenModal
 * @param {string} cssSelectorForModal
 * @param {scope} globals
 */
function customSubmitSuccessHandlerOpenModal(cssSelectorForModal, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    window.abbvModal.openModal(cssSelectorForModal);
}

/**
 * customSubmitSuccessHandlerWithRedirectParam
 * @name customSubmitSuccessHandlerWithRedirectParam
 * @param {string} paramName
 * @param {string} paramValue
 * @param {scope} globals
 */
function customSubmitSuccessHandlerWithRedirectParam(paramName, paramValue, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    var response = globals.event.payload.body;
    if (response && response.redirectUrl) {
        if (paramName == null || paramName == "" || paramValue == null || paramValue == "") {
            redirectToThankYouPage(response.redirectUrl);
        } else {
            // remove .html extension from the redirect URL if exists
            let redirectUrlWithoutHtml = response.redirectUrl.replace(/\.html$/, '');
            let urlWithParam = redirectUrlWithoutHtml + "?" + paramName + "=" + paramValue;
            redirectToThankYouPage(urlWithParam);
        }
    } else {
        console.error("No redirect URL found in the response.");
    }
}

/**
 * @name setDraftIdToBlank
 * @param {scope} globals
 */
function setDraftIdToBlank(globals) {
    // To avoid deleting the draft from Azure storage on successful form submission.
    globals.form.$properties['fd:draftId'] = '';
}

/**
 * Custom submit success handler for hiding the form and show page section.
 * @name customSubmitSuccessHandlerLoadPage
 * @param {string} classNameBefore - The class name of the section to hide
 * @param {string} classNameAfter - The class name of the section to show
 * @param {string} classNameHide - The class name to add for hiding the section
 * @param {scope} globals
 */
function customSubmitSuccessHandlerLoadPage(classNameBefore, classNameAfter, classNameHide, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    window.$('.' + classNameBefore).addClass(classNameHide);
    window.$('.' + classNameAfter).removeClass(classNameHide);
}

/**
 * Custom submit Complete Analytics handler for triggering submit event.
 * @name onSubmitCompleteAnalytics
 * @param {scope} globals
 */
function onSubmitCompleteAnalytics(globals) {
    if (analyticspayload.validPayload) {
        if (globals && globals.field && globals.field._jsonModel
            && globals.field._jsonModel.properties
            && globals.field._jsonModel.properties.cssClass
            && globals.field._jsonModel.properties.cssClass.includes('abbv-base-quizddg-sendnow-button')) {
            admp_analytics_functions.setFormStepName('send email');
            admp_analytics_functions.setInteractionType('Send Email');
        } else if (globals && globals.field && globals.field._jsonModel
            && globals.field._jsonModel.properties
            && globals.field._jsonModel.properties.cssClass
            && globals.field._jsonModel.properties.cssClass.includes('abbv-base-quizddg-downloadpdf-button')) {
            admp_analytics_functions.setFormStepName('pdf download');
            admp_analytics_functions.setInteractionType('File Download');
        } else {
            admp_analytics_functions.setFormStepName('submit');
        }
        analyticspayload.getFormCompletePayload();
    } else {
        analyticsFormSubmitEvent();
    }
}

/**
 * onSubmitClickedAnalytics
 * @param {string} [formStepName]
 * @param {string} [interactionType]
 * @name onSubmitClickedAnalytics
 */
function onSubmitClickedAnalytics(formStepName, interactionType) {
    window.parent.digitalData.page.mva.qa = "";
    if (formStepName && typeof formStepName === 'string') {
        admp_analytics_functions.setFormStepName(formStepName);
    } else {
        admp_analytics_functions.setFormStepName('submit');
    }
    if (interactionType && typeof interactionType === 'string') {
        admp_analytics_functions.setInteractionType(interactionType);
    } else {
        admp_analytics_functions.setInteractionType('Form Fill');
    }

    if (analyticspayload.validPayload) {
        analyticspayload.getFormCompletePayload();
    } else {
		let payloadString = payloadString.replace('"', "&#34;");
        admp_analytics_functions.onFormCompleteEvent(payloadString.slice(0, payloadString.length - 2));
    }
}

/**
 * customSubmitErrorHandler
 * @name customSubmitErrorHandler
 * @param {scope} globals
 */
function customSubmitErrorHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    try {
        var payload = JSON.parse(globals.event.payload.body);
        var errorList = extractErrorCodes(payload);
        if (!Array.isArray(errorList) || errorList.length === 0) {
            handleGenericError(globals);
        } else {
            handleFieldError(errorList, globals);
        }
        admp_analytics_functions.onFormSubmitError(errorList);
    } catch (e) {
        handleGenericError(globals);
    }
}

/**
 * extractErrorCodes
 * @name extractErrorCodes
 * @param payload - The response object containing potential error codes
 */
function extractErrorCodes(payload) {
    try {
        const jsonStartIndex = payload.detail.indexOf('{');
        const jsonSubstring = payload.detail.slice(jsonStartIndex);
        const parsedDetail = JSON.parse(jsonSubstring);
        return parsedDetail.errorList || [];
    } catch (e) {
        return [];
    }
}

/**
 * Recursively extracts error codes and their associated messages from a given JSON object.
 * @param {object | Array} jsonPayload JSON object or array to traverse for error details.
 * @param {Array<object>} [extractedErrors=[]] An array for the formatted error objects.
 * @returns {Array<object>} An array of objects, where each object represents an error
 *                          in the format: { "code": "message" }.
 */
function extractFormattedErrorDetails(jsonPayload, extractedErrors = []) {
    if (typeof jsonPayload !== 'object' || jsonPayload === null) {
        return extractedErrors;
    }

    // Handle arrays
    if (Array.isArray(jsonPayload)) {
        for (const item of jsonPayload) {
            extractFormattedErrorDetails(item, extractedErrors); // Recurse on each item in the array
        }
    } else {
        // Handle objects
        let currentErrorCode = null;
        let currentErrorMessage = null;

        for (const key in jsonPayload) {
            if (Object.prototype.hasOwnProperty.call(jsonPayload, key)) {
                const value = jsonPayload[key];

                // Store code and potential messages found at the current level
                if (key === 'code') {
                    currentErrorCode = String(value);
                } else if (key === 'message' || key === 'description') {
                    // Prioritize 'message' if both exist, but also consider 'description'
                    if (!currentErrorMessage) { // Only set if not already found at this level
                        currentErrorMessage = String(value);
                    }
                } else if (key === 'errorList' && Array.isArray(value)) {
                    // If an errorList is found, iterate through it and assume each item is an error code/message
                    for (const errorItem of value) {
                        // If errorItem is a string, assume it's just the code or message itself
                        if (typeof errorItem === 'string' || typeof errorItem === 'number') {
                            // If we have a code and no message yet, use the errorItem as the message
                            // Or if errorItem is a code itself, we might need a generic message
                            extractedErrors.push({[String(errorItem)]: `Error: ${String(errorItem)}`}); // Generic message for simple codes
                        } else if (typeof errorItem === 'object' && errorItem !== null) {
                            // If errorItem is an object, recurse to find its error details
                            extractFormattedErrorDetails(errorItem, extractedErrors);
                        }
                    }
                }
                // Recurse for nested objects/arrays, but do not process the same 'errorList' again
                else if (typeof value === 'object' && value !== null && key !== 'errorList') {
                    extractFormattedErrorDetails(value, extractedErrors);
                }
            }
        }

        // After iterating through properties at the current level,
        // if an errorCode and a message were found, add them to the results.
        if (currentErrorCode) {
            if (currentErrorMessage) {
                extractedErrors.push({[currentErrorCode]: currentErrorMessage});
            } else {
                // If no message was explicitly found alongside the errorCode, use a generic one
                extractedErrors.push({[currentErrorCode]: `Error with code: ${currentErrorCode}`});
            }
        }
    }

    return extractedErrors;
}

/* ------------------------------------------------------------------------------------------
 * Enterprise reCAPTCHA support for AJAX form submissions.
 *
 * The token is minted on submit and posted to the captcha api proxy, which asks Google to score
 * it server-side. The action below has to match CAPTCHA_ACTION in core.servlets.v1.APIProxyServlet
 * (not the same-named servlet in core.servlets, which is the shared legacy one) - the
 * servlet compares it against tokenProperties.action and rejects the token when they differ.
 *
 * The captcha api proxy treats the token as mandatory, so a submission that reaches it without one
 * is refused. When getEnterpriseToken cannot mint a token - captcha not configured for the
 * environment, the Google script blocked or unavailable, the site key lookup empty - it resolves to
 * '' and the submission is sent to the legacy proxy instead, which does not check captcha. See
 * resolveProxyApiUrl: the form keeps working, at the cost of that submission not being gated.
 * ------------------------------------------------------------------------------------------ */

var ABBVIE_CAPTCHA_ACTION = 'submit';
var ABBVIE_CAPTCHA_ERROR_CODE = '91111';
var abbvieCaptchaScriptPromise = null;

/* The shared proxy, used by several projects, and the fallback for a submission with no token. */
var ABBVIE_LEGACY_PROXY_URL = '/abbviecloud/bin/abbvie/apiproxy';
/* The captcha validating duplicate, used whenever a token could be minted. */
var ABBVIE_CAPTCHA_PROXY_URL = '/abbviecloud/bin/abbvie/v1/apiproxy';
/* Serves the invisible site key from the admin configuration - core.servlets.v1.CaptchaSiteKeyServlet. */
var ABBVIE_CAPTCHA_SITEKEY_URL = '/abbviecloud/bin/abbvie/v1/captchasitekey';
/* Cached site key lookup, so a multi step flow does not re-request it on every submit. */
var abbvieCaptchaSiteKeyPromise = null;

/**
 * getEnterpriseCaptchaSiteKey
 * @name getEnterpriseCaptchaSiteKey
 * @description Invisible enterprise site key, read from the admin configuration by
 * core.servlets.v1.CaptchaSiteKeyServlet. This used to come off AbbViePageInfo, which only the
 * common-elements page components publish - a form rendered outside such a page had no key at all.
 * The servlet reads the same configuration server side validation uses, so the minting key and the
 * validating key cannot drift apart.
 *
 * Resolved once per page and reused, so a multi step flow costs a single request. A failed or empty
 * lookup is not cached, so the next submit retries it. Resolving to '' keeps the existing fail
 * closed behaviour - see getEnterpriseToken.
 * @returns {Promise<string>} the site key, or '' when captcha is not configured for the environment
 */
function getEnterpriseCaptchaSiteKey() {
    if (abbvieCaptchaSiteKeyPromise) {
        return abbvieCaptchaSiteKeyPromise;
    }
    abbvieCaptchaSiteKeyPromise = fetch(ABBVIE_CAPTCHA_SITEKEY_URL, {
        method: 'GET',
        headers: {'Accept': 'application/json'}
    }).then(function (response) {
        if (!response.ok) {
            throw new Error('Site key request failed with status ' + response.status);
        }
        return response.json();
    }).then(function (body) {
        var siteKey = (body && body.siteKey) || '';
        if (!siteKey) {
            /* Captcha may simply not be configured yet - keep asking rather than caching a blank. */
            abbvieCaptchaSiteKeyPromise = null;
        }
        return siteKey;
    }).catch(function (error) {
        console.error('Unable to read the enterprise reCAPTCHA site key from ' + ABBVIE_CAPTCHA_SITEKEY_URL, error);
        abbvieCaptchaSiteKeyPromise = null;
        return '';
    });
    return abbvieCaptchaSiteKeyPromise;
}

/**
 * checkGrecaptchaEnterprise
 * @name checkGrecaptchaEnterprise
 * @description check grecaptcha.enterprise is available in page
 * @returns {Promise<boolean>} resolves true when grecaptcha.enterprise is usable
 */
function checkGrecaptchaEnterprise() {
  if (typeof grecaptcha !== "undefined" && grecaptcha.enterprise) {
    return Promise.resolve(true);
  }
  /* A promise either way - a bare false would blow up the caller's .then chain rather than let it
     fail closed on an empty token. */
  return Promise.resolve(false);
}

/**
 * resolveProxyApiUrl
 * @name resolveProxyApiUrl
 * @description Endpoint a submission should post to, decided by whether a captcha token could be
 * minted. A token goes to the captcha validating proxy, which scores it server side; no token goes
 * to the legacy proxy, which does not check captcha at all.
 *
 * That fallback keeps a form working where captcha is unavailable - script blocked, site key not
 * configured for the environment - instead of refusing the submission. The cost is that such a
 * submission is not gated, and the condition is observable from the browser, so it is a fallback
 * for availability rather than a security boundary.
 * @param {string} token the token from getEnterpriseToken, '' when none could be minted
 * @returns {string}
 */
function resolveProxyApiUrl(token) {
    return token ? ABBVIE_CAPTCHA_PROXY_URL : ABBVIE_LEGACY_PROXY_URL;
}

/**
 * validateCaptchaAction
 * @name validateCaptchaAction
 * @description The reCAPTCHA action a token is minted with. Google only accepts letters, digits,
 * slashes and underscores in an action name, so anything else falls back to ABBVIE_CAPTCHA_ACTION.
 *
 * validateCaptchaAction in core.servlets.v1.APIProxyServlet applies the same rule to the formAction it
 * receives, so both sides derive the same value from the same input - if that rule changes here it
 * has to change there too, or every submission fails the action comparison.
 * @param {string} formAction the form action the submission is posting, e.g. 'FindMyMsl'
 * @returns {string}
 */
function validateCaptchaAction(formAction) {
    if (typeof formAction === 'string' && /^[A-Za-z0-9/_]+$/.test(formAction)) {
        return formAction;
    }
    return ABBVIE_CAPTCHA_ACTION;
}

/**
 * getEnterpriseToken
 * @name getEnterpriseToken
 * @description Mints a fresh invisible enterprise reCAPTCHA token for the current submission.
 * The promise itself never rejects, so callers need no catch - but resolving to '' is not a free
 * pass. The captcha api proxy requires a token, so an empty one means the submission is refused
 * server-side and the caller's success handler raises the generic error banner via
 * isCaptchaValidationFailure.
 *
 * The token is bound to the operation it was minted for: pass the same formAction the payload
 * carries, and the proxy will only accept the token for that formAction. A token minted for the MSL
 * search can no longer be replayed against the ERAR submit.
 * @param {string} [formAction] the formAction being posted; omitted or unusable falls back to
 * ABBVIE_CAPTCHA_ACTION, which is also what the servlet expects for a payload without one
 * @returns {Promise<string>} the token, or '' when captcha is unavailable
 */
function getEnterpriseToken(formAction) {
    var captchaAction = validateCaptchaAction(formAction);
    return checkGrecaptchaEnterprise().then(function (available) {
        if (!available) {
            return '';
        }
        return getEnterpriseCaptchaSiteKey().then(function (siteKey) {
            /* No key, no execute - grecaptcha rejects an empty one anyway, and the empty token this
               returns instead is what the proxy refuses the submission on. */
            if (!siteKey) {
                return '';
            }
            return new Promise(function (ready) {
                grecaptcha.enterprise.ready(ready);
            }).then(function () {
                return grecaptcha.enterprise.execute(siteKey, {action: captchaAction});
            });
        });
    }).catch(function (error) {
        console.error('Unable to generate enterprise reCAPTCHA token', error);
        return '';
    });
}


/**
 * isCaptchaValidationFailure
 * @name isCaptchaValidationFailure
 * @description True when the proxy rejected the request because server side captcha validation
 * failed. The proxy answers with HTTP 200 and an error envelope, so the status code cannot be used.
 * @param response - the proxy response, parsed or raw
 * @returns {boolean}
 */
function isCaptchaValidationFailure(response) {
    if (!response) {
        return false;
    }
    var body = response;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (error) {
            return false;
        }
    }
    var errors = body.ErrorResponseMessageList;
    return !!(errors && errors.length && errors[0].ErrorCode === ABBVIE_CAPTCHA_ERROR_CODE);
}

/**
 * handleCaptchaValidationFailure
 * @name handleCaptchaValidationFailure
 * @description Surfaces a failed server side captcha check as the standard generic error message
 * at the top of the form, and resets the captcha so the next attempt gets a fresh token.
 * @param {scope} globals
 */
function handleCaptchaValidationFailure(globals) {
    /* Every other *HandleErrorResponse variant clears the loading state and any stale guide
       messages before revealing the banner. */
    baseSubmitReset();
    /* Show the banner before anything else, so a missing analytics client lib cannot suppress it. */
    try {
        handleGenericError(globals);
    } catch (error) {
        /* Forms that do not author a Generic-Error-Fragment cannot show the standard banner. */
        console.error('Captcha validation failed and no Generic-Error-Fragment is authored on this form', error);
    }
    if (window.admp_analytics_functions) {
        admp_analytics_functions.onFormSubmitError('Captcha Validation failed');
    }
}

/**
 * handleGenericError
 * @name handleGenericError
 * @param {scope} globals
 */
function handleGenericError(globals) {
    var errorContainer = guideBridge.resolveNode('$form.Generic-Error-Fragment');
    errorContainer.visible = true;
    const $target = $('.forms-embed');
    // In some forms like Linzess, scroll to form-embed div does not work as expected, because navigation is covering the error message.
    // So added an option to scroll to body top instead of form-embed div. Add a hidden field with the name 'scrollToBody' and value 'true' to enable this feature.
    if (globals.form && globals.form.scrollToBody && globals.form.scrollToBody.$value && globals.form.scrollToBody.$value === 'true') {
        $('html, body').animate({
            scrollTop: $('body').offset().top
        }, 0);
        // If scrollOffset is defined, use it to adjust the scroll position from form-embed div.
    } else if (globals.form && globals.form.scrollOffset && globals.form.scrollOffset.$value && globals.form.scrollOffset.$value) {
        $('html, body').animate({
            scrollTop: $target.offset().top - parseInt(globals.form.scrollOffset.$value, 10)
        }, 0);
    } else if ($target.length) {
        $('html, body').animate({
            scrollTop: $target.offset().top
        }, 0);
    }
}

/**
 * handleFieldError
 * @name handleFieldError
 * @param errorList - The list of error codes to check against the form fields
 * @param {scope} globals
 */
function handleFieldError(errorList, globals) {
    if (errorList && errorList.length > 0) {
        const formFields = globals.form.$items;
        const errorField = verifyErrorCodeAndDisplayError(globals, formFields, errorList);
        if (errorField) {
            globals.functions.setFocus(errorField);
        } else {
            showGenericErrorByCode(globals, errorList);
        }
    }
}

/**
 * verifyErrorCodeAndDisplayError
 * @name verifyErrorCodeAndDisplayError
 * @param globals - The global scope containing the form and functions
 * @param formFields - The list of form fields to check for error codes
 * @param errorList - The list of error codes to check against the form fields
 * @param firstErrorField -  The first error field found, if any
 */
function verifyErrorCodeAndDisplayError(globals, formFields, errorList, firstErrorField) {
    for (const formField of formFields) {
        // If the field is a panel, recursively verify its items
        if (formField.$fieldType === 'panel') {
            firstErrorField = verifyErrorCodeAndDisplayError(globals, formField.$items, errorList, firstErrorField);
            continue;
        }

        const properties = formField.$properties;

        // Get the keys (e.g. ['err51025', 'cssClass', ...])
        const propertyKeys = Array.isArray(properties) ? properties : Object.keys(properties);

        // Find all property keys that contain any known error code
        const matchingKeys = propertyKeys.filter(key =>
            errorList.some(errorObj =>
                Object.keys(errorObj).some(errorCode => key.includes(errorCode))
            )
        );

        // Apply errors for each matching key
        for (const key of matchingKeys) {
            const errorMessage = properties[key];
            if (errorMessage) {
                globals.functions.setProperty(formField, {valid: false});
                globals.functions.setProperty(formField, {errorMessage});

                if (!firstErrorField && formField.$visible) {
                    firstErrorField = formField;
                }
            }
        }
    }

    return firstErrorField;
}

/**
 * redirectToThankYouPage
 * @name redirectToThankYouPage
 * @param {string} url - The URL to redirect to after successful form submission
 * @param url
 */
function redirectToThankYouPage(url) {
    window.parent.location = url;
}

/**
 * @name apigeeRegistrationOnSubmitClick
 * @param roleRadioButton
 * @param intresteinInInformationRadioButton
 * @param prescribedRadioButton
 */
function apigeeRegistrationOnSubmitClick(roleRadioButton, intresteinInInformationRadioButton, prescribedRadioButton) {
    if (roleRadioButton.value && intresteinInInformationRadioButton.value == "7" && prescribedRadioButton.value == "5") {
        sessionStorage.setItem('epcorindication', "DLBCL Efficacy");
        console.log("epcorindication", sessionStorage.getItem('epcorindication'));
    } else if (roleRadioButton.value && intresteinInInformationRadioButton.value == "8" && prescribedRadioButton.value == "5") {
        sessionStorage.setItem('epcorindication', "FL Efficacy");

    } else if (roleRadioButton.value == "4" && intresteinInInformationRadioButton.value == "7" && prescribedRadioButton.value == "4") {
        sessionStorage.setItem('epcorindication', "DLBCL Patient Support");

    } else if (roleRadioButton.value == "5" && intresteinInInformationRadioButton.value == "7" && prescribedRadioButton.value == "4") {
        sessionStorage.setItem('epcorindication', "DLBCL Care Partner Support");

    } else if (roleRadioButton.value == "4" && intresteinInInformationRadioButton.value == "8" && prescribedRadioButton.value == "4") {
        sessionStorage.setItem('epcorindication', "FL Patient Support");

    } else if (roleRadioButton.value == "5" && intresteinInInformationRadioButton.value == "8" && prescribedRadioButton.value == "4") {
        sessionStorage.setItem('epcorindication', "FL Care Partner Support");
    }
}

/**
 * Custom onload handler for hiding the page section and show form section.
 * @name customHandlerPageLoad
 * @param {scope} globals
 * @param {string} classNameBefore - The class name of the section to hide
 * @param {string} classNameAfter - The class name of the section to show
 * @param {string} classNameHide - The class name to add for hiding the section
 */
function customHandlerPageLoad(globals, classNameBefore, classNameAfter, classNameHide) {
    window.$('.' + classNameBefore).addClass(classNameHide);
    window.$('.' + classNameAfter).removeClass(classNameHide);
}

/**
 * Custom submit handler for both Brand API and APIGEE API.
 * @name baseApigeeRegistrationSubmitAction
 * @param {scope} globals
 */
function baseApigeeRegistrationSubmitAction(globals) {
    const errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        let formData = globals.functions.exportData();
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}

/**
 * baseApigeeRegistrationSuccessHandler
 * @name baseApigeeRegistrationSuccessHandler
 * @param {scope} globals
 */
function baseApigeeRegistrationSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    const successKey = "IsStatusSuccessful=";
    const successStart = jsonString.indexOf(successKey) + successKey.length;
    const successEnd = jsonString.indexOf(",", successStart);
    const isStatusSuccessful = jsonString.substring(successStart, successEnd);
    if (isStatusSuccessful === 'true') {
        const emailKey = "Email=";
        const startIndex = jsonString.indexOf(emailKey) + emailKey.length;
        const endIndex = jsonString.indexOf("}", startIndex);
        const demographicEmail = jsonString.substring(startIndex, endIndex);
        if (demographicEmail !== 'undefined') {
            sessionStorage.setItem('demographicEmail', demographicEmail);
        }

        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        const response = globals.event.payload.body;
        var redirectURL = response.redirectUrl;
        if (response && redirectURL) {
            if (redirectURL.endsWith(".html")) {
                redirectURL = redirectURL.replace(/\.html$/, '');
            }
            redirectToThankYouPage(redirectURL);
        }
    }
}

/**
 * apigeeRegistrationCardSuccessHandler
 * @name apigeeRegistrationCardSuccessHandler
 * @param {scope} globals
 */
function apigeeRegistrationCardSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    const successKey = "IsStatusSuccessful=";
    const successStart = jsonString.indexOf(successKey) + successKey.length;
    const successEnd = jsonString.indexOf(",", successStart);
    const isStatusSuccessful = jsonString.substring(successStart, successEnd);
    if (isStatusSuccessful === 'true') {
        const emailKey = "Email=";
        const startIndex = jsonString.indexOf(emailKey) + emailKey.length;
        const endIndex = jsonString.indexOf("}", startIndex);
        const demographicEmail = jsonString.substring(startIndex, endIndex);
        if (demographicEmail !== 'undefined') {
            sessionStorage.setItem('demographicEmail', demographicEmail);
        }

        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        let cardAction = getSessionStorage('cardAction');
        if (cardAction === 'newCard') {
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
        } else if (cardAction === 'activate') {
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);
        }
    }
}

/**
 * baseApigeeRegistrationErrorHandler
 * @name baseApigeeRegistrationErrorHandler
 * @param {scope} globals
 */
function baseApigeeRegistrationErrorHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    let errorResponse = globals.event.payload.body;
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);
    console.log('guideResultObject: ' + JSON.stringify(errorResponse));
    admp_analytics_functions.onFormSubmitError(errorList);
    baseHandleErrorResponse(errorList, globals);
}

/**
 * @name baseVerifyEmailAddress
 * @param {object} email
 * @param {object} verifyEmail
 * @param {string} errMsg
 * @param {scope} globals
 * @returns {boolean}
 */
function baseVerifyEmailAddress(email, verifyEmail, errMsg, globals) {
    const emailValue = email.$value ? email.$value.trim() : '';
    const verifyEmailValue = verifyEmail.$value ? verifyEmail.$value.trim() : '';
    if ((verifyEmailValue && (!emailValue || emailValue !== verifyEmailValue))) {
        globals.functions.setProperty(verifyEmail, {errorMessage: errMsg});
        return false;
    }

    if (emailValue && verifyEmailValue && emailValue === verifyEmailValue) {
        globals.functions.setProperty(verifyEmail, {errorMessage: ''});
        return true;
    }
    return true;

}

/**
 * setSessionStorage
 * @param {string} key
 * @param {string} value
 */
function setSessionStorage(key, value) {
    if (key && value) {
        sessionStorage.setItem(key, value);
    }
}

/**
 * deleteSessionStorage
 * @param {string} key
 */
function deleteSessionStorage(key) {
    if (key) {
        sessionStorage.removeItem(key);
    }
}

/**
 * getLocalStorage
 * @param {string} key
 */
function getLocalStorage(key) {
    return localStorage.getItem(key);
}

/**
 * setLocalStorage
 * @param {string} key
 * @param {string} value
 */
function setLocalStorage(key, value) {
    if (key && value) {
        localStorage.setItem(key, value);
    }
}

/**
 * deleteLocalStorage
 * @param {string} key
 */
function deleteLocalStorage(key) {
    if (key) {
        localStorage.removeItem(key);
    }
}

/**
 * onSubmitWithCheckboxValidation
 * @name onSubmitWithCheckboxValidation
 * @param {object} checkboxGroupPanel
 * @param {object} errorMessageObject
 * @param {scope} globals
 */
function onSubmitWithCheckboxValidation(checkboxGroupPanel, errorMessageObject, globals) {
    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();
    let validationFailed = validateDsaRegCheckboxGroup(checkboxGroupPanel, errorMessageObject, globals);

    if (!validationFailed && (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha')))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}

/**
 * onPSADSASubmitWithCheckboxValidation
 * @name onPSADSASubmitWithCheckboxValidation
 * @param {object} accountPanel
 * @param {object} checkboxGroupPanel
 * @param {object} errorMessageObject
 * @param {number} cookieLife
 * @param {scope} globals
 */
function onPSADSASubmitWithCheckboxValidation(accountPanel, checkboxGroupPanel, errorMessageObject, cookieLife, globals) {
    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();
    let validationFailed = validateDsaRegCheckboxGroup(checkboxGroupPanel, errorMessageObject, globals);

     var registeredUser= {
        firstName: accountPanel.FullNamePanel.firstNamePSA.$value,
        lastName: accountPanel.FullNamePanel.lastnamePSA.$value,
        emailId: accountPanel.EmailAddressPSA.$value
     };
     var encryptReq = window.sjcl.encrypt( '', JSON.stringify(registeredUser));
     setCookie('admp_PSARegistration', encryptReq, true, cookieLife);

    if (!validationFailed && (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha')))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}

/**
 * brandApiCombinedRegistrationSuccessHandler
 * @name brandApiCombinedRegistrationSuccessHandler
 * @param {scope} globals
 */
function brandApiCombinedRegistrationSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;

    var psaResponse = response.metadata.FormSubmitInfo;

        var consId = psaResponse.match(/ConsumerId=([^,}]+)/)?.[1];
        var isStatusSuccessful = psaResponse.match(/IsStatusSuccessful=([^,}]+)/)?.[1];

        if (psaResponse && isStatusSuccessful ==='true') {
            if (typeof psaResponse !== 'undefined' && typeof consId !== 'undefined') {
                    sessionStorage.setItem('consumerId',consId);
        }
    } else if(psaResponse && isStatusSuccessful ==='false') {
        var email = psaResponse.match(/Email=([^,}]+)/)?.[1];
        if (typeof psaResponse.RegistrationResponse !== 'undefined' && typeof email !== 'undefined') {
            sessionStorage.setItem('demographicEmail', email);
        }
    }

    if (analyticspayload.validPayload) {
        admp_analytics_functions.setFormStepName('submit');
        analyticspayload.getFormCompletePayload();
    } else {
        analyticsFormSubmitEvent();
    }
    const registrationTypeKey = "RegistrationType=";
    const registrationStart = response.metadata.FormSubmitInfo.indexOf(registrationTypeKey) + registrationTypeKey.length;
    const registrationEnd = response.metadata.FormSubmitInfo.indexOf(",", registrationStart);
    const registrationType = response.metadata.FormSubmitInfo.substring(registrationStart, registrationEnd);
    if (registrationType === 'DSARegistration') {
        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);
    } else {
        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
    }
}

/**

 * customSubmitSuccessFormPanelHandler
 * @name customSubmitSuccessFormPanelHandler
 * @param {object} formPanel
 * @param {object} thankyouPanel
 * @param {object} [errorFragment] errorFragment, optional
 * @param {scope} globals
 */
function customSubmitSuccessFormPanelHandler(formPanel, thankyouPanel, errorFragment, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    const response = globals.event.payload.body;
    if (response) {
        const fullApiResponse = JSON.parse(response.metadata.fullApiResponse);
        if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
            globals.functions.setProperty(formPanel, {visible: false});
            globals.functions.setProperty(errorFragment, {visible: false});
            globals.functions.setProperty(thankyouPanel, {visible: true});
        } else {
            console.error("No Panel found");
        }
    } else {
        console.error("No response found in the payload.");
    }
}

/**
 * getSessionStorage
 * @param {string} key
 * @returns {null|string}
 */
function getSessionStorage(key) {
    if (key) {
        return sessionStorage.getItem(key);
    }
    return null;
}

/**
 * populateElementFromSessionStorage
 * @param {string} key
 * @param {string} className
 */
function populateElementFromSessionStorage(key, className) {
    if (key) {
        $('.' + className).html(sessionStorage.getItem(key));
    }
}

/**
 * getSessionStorageAndRedirect
 * @param {string} key
 * @param {object} url
 */
function getSessionStorageAndRedirect(key, url) {
    if (key) {
        const value = sessionStorage.getItem(key);
        if (value === null && url) {
            window.parent.location = url.value;
        }
    }
}

/*** Form-Specific Functions ***/

/**
 * registrationSavingCardActivateSuccessHandler
 * @name registrationSavingCardActivateSuccessHandler
 * @param {scope} globals
 */
function registrationSavingCardActivateSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    sessionStorage.removeItem('demographicEmail');
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);
    localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.RegistrationResponse.coPay));
    sessionStorage.setItem('activateCard', 'newCard');
    sessionStorage.removeItem('vraylarMobileOptin');
    sessionStorage.removeItem('vraylarOptin');
    sessionStorage.removeItem('vraylarGuid');
    sessionStorage.removeItem('vrayalarScIndicationValue');
    sessionStorage.removeItem('vrayalarScIndicationText');
    onSubmitCompleteAnalytics(globals);
    redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);

}

/**
 * fetzimaSavingCardActivateSuccessHandler
 * @name fetzimaSavingCardActivateSuccessHandler
 * @param {scope} globals
 */
function fetzimaSavingCardActivateSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    sessionStorage.removeItem('demographicEmail');
    sessionStorage.removeItem('activateCard');
    localStorage.removeItem('savingcard');
    sessionStorage.removeItem('fetzimaGuid');
    sessionStorage.removeItem('fetzimaOptin');
    localStorage.removeItem('admp_cci');
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);
    localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.coPay[0]));

    if (analyticspayload.validPayload) {
        admp_analytics_functions.setFormStepName('submit');
        analyticspayload.getFormCompletePayload();
    } else {
        analyticsFormSubmitEvent();
    }
    redirectToThankYouPage(window.abbviecloudforms.core.formProperties.thankyoupagedualone);
}

/**
 * registrationSavingCardActivateErrorHandler
 * @name registrationSavingCardActivateErrorHandler
 * @param {object} [errorPanel] - Optional panel to show instead of redirecting when errorCode '60011' is present
 * @param {boolean} [usePanelInsteadOfRedirect=false] - When true and errorPanel provided, show the panel instead of redirecting (default preserves existing redirect behavior)
 * @param {scope} globals - The global scope containing the form and functions
 *
 * Backwards compatible:
 * - old usage: registrationSavingCardActivateErrorHandler(globals)
 * - new usage: registrationSavingCardActivateErrorHandler(errorPanel, usePanelInsteadOfRedirect, globals)
 */
function registrationSavingCardActivateErrorHandler(errorPanel, usePanelInsteadOfRedirect, globals) {
    // helper to identify the globals object
    function looksLikeGlobals(obj) {
        return obj && typeof obj === 'object' && obj.event && obj.functions && obj.form;
    }

    var _globals, _errorPanel, _usePanel;

    // If called with the old single-argument signature: registrationSavingCardActivateErrorHandler(globals)
    if (looksLikeGlobals(errorPanel) && typeof usePanelInsteadOfRedirect === 'undefined' && typeof globals === 'undefined') {
        _globals = errorPanel;
        _errorPanel = undefined;
        _usePanel = false;
    } else {
        // new signature or mixed; determine globals from last argument if it looks like globals
        if (looksLikeGlobals(globals)) {
            _globals = globals;
            _errorPanel = errorPanel;
            _usePanel = usePanelInsteadOfRedirect;
        } else if (looksLikeGlobals(usePanelInsteadOfRedirect)) {
            // handle call registrationSavingCardActivateErrorHandler(errorPanel, globals) (usePanel omitted)
            _globals = usePanelInsteadOfRedirect;
            _errorPanel = errorPanel;
            _usePanel = false;
        } else {
            // fallback: try last argument
            _globals = arguments[arguments.length - 1];
            _errorPanel = errorPanel;
            _usePanel = usePanelInsteadOfRedirect;
        }
    }

    // normalize flag to boolean (default false)
    var usePanel = Boolean(_usePanel);

    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(_globals);
    let errorResponse = _globals.event.payload.body;
    let payload;
    try {
        payload = JSON.parse(_globals.event.payload.body);
    } catch (e) {
        payload = _globals.event.payload.body;
    }
    let errorList = extractErrorCodes(payload);
    console.log('guideResultObject: ' + JSON.stringify(errorResponse));
    admp_analytics_functions.onFormSubmitError(errorList);

    for (var i = 0; i < errorList.length; i++) {
        var errorCode = Object.keys(errorList[i])[0];
        if (errorCode === '60011') {
            if (usePanel && _errorPanel) {
                _globals.functions.setProperty(_errorPanel, {visible: true});
            } else {
                // default behavior: redirect to DSA thank you page
                if (window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl) {
                    redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);
                } else if (window.abbviecloudforms.core.formProperties.thankyoupagedualtwo) {
                    redirectToThankYouPage(window.abbviecloudforms.core.formProperties.thankyoupagedualtwo);
                }

            }
            return;
        }
    }
    baseHandleErrorResponse(errorList, _globals);
}

/**
 * registrationUbrelvyCardActivateSuccessHandler
 * @name registrationUbrelvyCardActivateSuccessHandler
 * @param {object} insuranceRadioButton
 * @param {object} savingsCardRadioButton
 * @param {scope} globals
 */
function registrationUbrelvyCardActivateSuccessHandler(insuranceRadioButton, savingsCardRadioButton, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    sessionStorage.removeItem('demographicEmail');
    localStorage.removeItem('admp_cci');
    localStorage.removeItem('savingsCard_ID');
    sessionStorage.removeItem('signupMessage');
    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.RegistrationResponse.WalletURLs) {
        localStorage.setItem('admp_walletURLs', JSON.stringify(fullApiResponse.RegistrationResponse.WalletURLs));
    }
    if (insuranceRadioButton.$value !== "1") {
        sessionStorage.setItem('signupMessage', 'noteligible');
    } else {
        if (fullApiResponse.RegistrationResponse.coPay || (fullApiResponse.RegistrationResponse.coPay && savingsCardRadioButton.$value === "No")) {
            localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.RegistrationResponse.coPay));
            sessionStorage.setItem('signupMessage', 'download');
        } else {
            sessionStorage.setItem('signupMessage', 'activation');
        }
    }
    redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
}

/**
 * registrationViberziCardActivateSuccessHandler
 * @name registrationViberziCardActivateSuccessHandler
 * @param {scope} globals
 */
function registrationViberziCardActivateSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    sessionStorage.removeItem('demographicEmail');
    localStorage.removeItem('savingcard');
    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true") {
        localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.RegistrationResponse.coPay));
        sessionStorage.removeItem('vibMobileOptin');
        sessionStorage.removeItem('viberziGuid');
        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
    } else {
        registrationSavingCardActivateErrorHandler(globals);
    }
}

/**
 * viberziSubmitAction
 * @name viberziSubmitAction
 * @param {string} [action] either 'activate' or 'newCard', 'activate' redirects to dsaregistrationthankyoupageurl, 'newCard' to registrationthankyoupageurl.
 * @param {object} analyticsPayloadPanel
 * @param {scope} globals
 */
function viberziSubmitAction(action, analyticsPayloadPanel, globals) {
    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();
    if (analyticspayload.validPayload && analyticsPayloadPanel) {
        analyticspayload.resetPayload(analyticsPayloadPanel);
    }

    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        sessionStorage.setItem('cardAction', action);
       fetchObservabilityAndSubmit(globals, formData);
    }
}

/**
 * viberziSubmitSuccessHandler
 * @name viberziSubmitSuccessHandler
 * @param {scope} globals
 */
function viberziSubmitSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    //converting errorResponse.RegistrationResponse.IsStatusSuccessful into string because of inconsistent api response
    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        if (typeof fullApiResponse.RegistrationResponse !== 'undefined' && typeof fullApiResponse.RegistrationResponse.PatientDemographic !== 'undefined') {
            var demographicEmail = fullApiResponse.RegistrationResponse.PatientDemographic.Email;
            if (demographicEmail !== 'undefined') {
                sessionStorage.setItem('demographicEmail', demographicEmail);
            }
        }
        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }
        let cardAction = getSessionStorage('cardAction');
        if (cardAction === 'newCard') {
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
        } else if (cardAction === 'activate') {
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);
        }
    } else {
        admp_analytics_functions.onFormSubmitError(fullApiResponse);
        if (fullApiResponse.RegistrationResponse) {
            baseHandleErrorResponse(fullApiResponse.RegistrationResponse);
        } else {
            baseHandleErrorResponse(fullApiResponse);
        }
    }
}

/**
 * registrationTaytullaSuccessHandler
 * @name registrationTaytullaSuccessHandler
 * @param {scope} globals
 */
function registrationTaytullaSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true") {
        localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.RegistrationResponse.coPay));
        baseURLRedirection(response.data.thankYouPageURL);
    } else {
        registrationSavingCardActivateErrorHandler(globals);
    }
}

/**
 * baseDsaRegistrationSuccessHandler
 * @name baseDsaRegistrationSuccessHandler
 * @param {string} [cookieName]
 * @param {string} [prefillAnswer]
 * @param {scope} globals
 */
function baseDsaRegistrationSuccessHandler(cookieName, prefillAnswer, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    //converting errorResponse.RegistrationResponse.IsStatusSuccessful into string because of inconsistent api response
    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        if (typeof fullApiResponse.RegistrationResponse !== 'undefined' && typeof fullApiResponse.RegistrationResponse.PatientDemographic !== 'undefined') {
            var demographicEmail = fullApiResponse.RegistrationResponse.PatientDemographic.Email;
            if (demographicEmail !== 'undefined') {
                sessionStorage.setItem('demographicEmail', demographicEmail);
            }
        }
        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }
        if (cookieName && prefillAnswer) {
            setCookie(cookieName + '=' + prefillAnswer, true, 365 * 24 * 60 * 60);
        }
        if (response.data && response.data.thankYouPageURL) {
            baseURLRedirection(response.data.thankYouPageURL);
        } else {
            redirectToThankYouPage(response.redirectUrl);
        }

    } else {
        admp_analytics_functions.onFormSubmitError(fullApiResponse);
        if (fullApiResponse.RegistrationResponse) {
            baseHandleErrorResponse(fullApiResponse.RegistrationResponse);
        } else {
            baseHandleErrorResponse(fullApiResponse);
        }
    }
}


/**
 * fetzimaActivateCardSuccessHandler
 * @name fetzimaActivateCardSuccessHandler
 * @param {string} [cookieName]
 * @param {string} [prefillAnswer]
 * @param {scope} globals
 */
function fetzimaActivateCardSuccessHandler(cookieName, prefillAnswer, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    //converting errorResponse.RegistrationResponse.IsStatusSuccessful into string because of inconsistent api response
    if (fullApiResponse.isStatusSuccessful || (String(fullApiResponse.isStatusSuccessful).toLowerCase() === "true")) {
        var encryptedDtls = fullApiResponse.encryptedDetails;
        if (typeof encryptedDtls !== 'undefined' && encryptedDtls.length > 0) {
            var emailId = null;
            for (var i = 0; i < encryptedDtls.length; i++) {
                if (encryptedDtls[i].key === "EmailId") {
                    emailId = encryptedDtls[i].value;
                    break;
                }
            }
            if (emailId !== null) {
                sessionStorage.setItem('demographicEmail', emailId);
            }
        }

        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        if (response.data && response.data.thankYouPageURL) {
            baseURLRedirection(response.data.thankYouPageURL);
        } else {
            redirectToThankYouPage(response.redirectUrl);
        }

    } else {
        admp_analytics_functions.onFormSubmitError(fullApiResponse);
        if (fullApiResponse.RegistrationResponse) {
            baseHandleErrorResponse(fullApiResponse.RegistrationResponse);
        } else {
            baseHandleErrorResponse(fullApiResponse);
        }
    }
}


/**
 * viibrydSubmitAction
 * @name viibrydSubmitAction
 * @param {scope} globals
 */
function viibrydSubmitAction(globals) {
    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();
    if (analyticspayload.validPayload) {
        admp_analytics_functions.setFormStepName('submit');
        analyticspayload.getFormCompletePayload();
    } else {
        analyticsFormSubmitEvent();
    }
    localStorage.removeItem('admp_cci');

    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}

/**
 * viibrydSubmitSuccessHandler
 * @name viibrydSubmitSuccessHandler
 * @param {scope} globals
 */
function viibrydSubmitSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        var demographicEmail = fullApiResponse.RegistrationResponse.PatientDemographic.Email;
        if (demographicEmail !== 'undefined') {
            sessionStorage.setItem('demographicEmail', demographicEmail);
        }
        if (fullApiResponse.RegistrationResponse.coPay) {
            localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.RegistrationResponse.coPay));
            sessionStorage.removeItem('viibrydOptin');
            sessionStorage.removeItem('viibrydMobileOptin');
            sessionStorage.removeItem('viibrydGuid');
        }

        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
    } else {
        registrationSavingCardActivateErrorHandler(globals);
    }
}

/**
 * validateStepOnePanelAndShowStepTwoPanel
 * @name validateStepOnePanelAndShowStepTwoPanel
 * @description Validates the current panel, when satisfies the condition, shows the next panel if validation passes.
 * @param {object} panel
 * @param {object} locationRadioButton
 * @param {object} insuranceRadioButton
 * @param {string} notEligibleUrl redirection url for Not Eligible scenario
 * @param {object} nextPanel
 * @param {scope} globals
 */
function validateStepOnePanelAndShowStepTwoPanel(panel, locationRadioButton, insuranceRadioButton, notEligibleUrl, nextPanel, globals) {
    const validationResult = globals.functions.validate(panel);
    if (validationResult.length === 0) {
        if (locationRadioButton.$value === "1" && insuranceRadioButton.$value === "1") {
            globals.functions.setProperty(panel, {
                visible: false
            });
            globals.functions.setProperty(nextPanel, {
                visible: true
            });
        } else {
            sessionStorage.setItem('signupMessage', 'noteligible');
            window.parent.location = notEligibleUrl;
        }
    } else {
        panel.$items.forEach(item => {
            if (item.$id === validationResult[0].fieldName) {
                globals.functions.setProperty(item, {
                    valid: false
                });
                globals.functions.setFocus(item);
            }
        });
    }
}

/**
 * challengeRegistrationUbrelvySuccessHandler
 * @name challengeRegistrationUbrelvySuccessHandler
 * @param {object} savingsCardRadioButton
 * @param {scope} globals
 */
function challengeRegistrationUbrelvySuccessHandler(savingsCardRadioButton, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    localStorage.removeItem('admp_cci');
    sessionStorage.removeItem('signupMessage');
    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.RegistrationResponse.coPay) {
        localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.RegistrationResponse.coPay));
        sessionStorage.setItem('signupMessage', 'savingCard');
    }
    if (savingsCardRadioButton.$value === "2") {
        sessionStorage.setItem('signupMessage', 'savingCard');

        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
        return;
    } else {
        sessionStorage.setItem('signupMessage', 'challengeCard');
    }
    redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);

}

/**
 * eapiSubmit
 * @name eapiSubmit
 * @param {scope} globals
 */
function eapiSubmit(globals) {
    var formData = globals.functions.exportData();
    cleanCampaignsPayload(formData);
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);

        guideBridge.on("elementEnableChanged", function (event, payload) {
            var component = payload.target; // Field whose value has changed
            if (component.name == thankyouPanelTextbox.name && component.enabled) {
                globals.form.saveButton.visible = false;
                globals.form.thankYouPanel.visible = true;
            }
        });
    }
}

function cleanCampaignsPayload(data) {
    // Flag to track if the 'campaigns' array was successfully processed and modified
    let wasCleaned = false;

    // Check for the new nesting structure: data.EapiRegistrationResponse.campaign.campaigns
    const campaignsPath = data && data.EapiRegistrationResponse && data.EapiRegistrationResponse.campaign;

    if (!campaignsPath || !Array.isArray(campaignsPath.campaigns)) {
        console.error("Payload structure is invalid or 'campaigns' array is missing at EapiRegistrationResponse.campaign.campaigns.");
        // Return false to indicate the expected structure was not found.
        return false;
    }

    const requiredKeys = [
        "responseId",
        "questionId",
        "questionText",
        "responseText",
        "campaignId"
    ];
    const validCampaigns = [];
    const currentCampaigns = campaignsPath.campaigns;

    // Iterate through the original array without using the filter function.
    for (const campaignEntry of currentCampaigns) {
        // Check if all required keys are present in the current campaign entry.
        const isValid = requiredKeys.every(key =>
            // The key must exist AND its value must not be null/undefined.
            Object.prototype.hasOwnProperty.call(campaignEntry, key) &&
            campaignEntry[key] !== null &&
            campaignEntry[key] !== undefined
        );

        if (isValid) {
            validCampaigns.push(campaignEntry);
        }
    }

    // Only mutate the data if the structure was valid
    campaignsPath.campaigns = validCampaigns;
    wasCleaned = true;

    // Return true to indicate the array was successfully accessed and cleaned.
    return wasCleaned;
}

/**
 * eApiRegistrationSuccess
 * @name eApiRegistrationSuccess
 * @param {string} emailTextbox
 * @param {scope} globals
 */
function eApiRegistrationSuccess(emailTextbox, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    const successKey = "IsStatusSuccessful=";
    const successStart = jsonString.indexOf(successKey) + successKey.length;
    const successEnd = jsonString.indexOf("}", successStart);
    const isStatusSuccessful = jsonString.substring(successStart, successEnd);
    if (isStatusSuccessful === 'true') {
        baseApigeeSuccessAction(response);
        setSessionStorage('from_registration', 'true');
        localStorage.setItem(emailTextbox, 'registered');
        baseURLRedirection(response.data.thankYouPageURL);
    } else {
        baseHandleErrorResponse(response);
        admp_analytics_functions.onFormSubmitError(response);
    }
}

/**
 * eapiSubmitSuccess
 * @name eapiSubmitSuccess
 * @param {object} [thankYouPanel]
 * @param {scope} globals
 */
function eapiSubmitSuccess(thankYouPanel, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    const successKey = "IsStatusSuccessful=";
    const successStart = jsonString.indexOf(successKey) + successKey.length;
    const successEnd = jsonString.indexOf("}", successStart);
    const isStatusSuccessful = jsonString.substring(successStart, successEnd);
    if (isStatusSuccessful === 'true') {
        baseApigeeSuccessAction(response);
        if (thankYouPanel) {
            globals.functions.setProperty(thankYouPanel, {visible: true});
        } else {
            baseURLRedirection(window.abbviecloudforms.core.formProperties.thankyoupageurl, globals);
        }
    } else {
        eApiRegistrationFailure(globals);
    }
}

/**
 * eApiRegistrationFailure
 * @name eApiRegistrationFailure
 * @param {scope} globals
 */
function eApiRegistrationFailure(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);
    baseHandleErrorResponse(errorList, globals);
    admp_analytics_functions.onFormSubmitError(response);
}

/**
 * customSubmitSuccessHandlerWithSettingCookie
 * @name customSubmitSuccessHandlerWithSettingCookie
 * @param {string} cookieName
 * @param {string} prefillAnswer
 * @param {scope} globals
 */
function customSubmitSuccessHandlerWithSettingCookie(cookieName, prefillAnswer, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    if (cookieName && prefillAnswer) {
        setCookie(cookieName + '=' + prefillAnswer, true, 365 * 24 * 60 * 60);
    }
    var response = globals.event.payload.body;
    if (response && response.redirectUrl) {
        redirectToThankYouPage(response.redirectUrl);
    } else {
        console.error("No redirect URL found in the response.");
    }
}

/**
 * customSubmitSuccessHandlerWithSettingCookieWithExpiredDays
 * @name customSubmitSuccessHandlerWithSettingCookieWithExpiredDays
 * @param {string} cookieName Name of the cookie
 * @param {string} prefillAnswer Value to be set in the cookie
 * @param {number} expiredDays Number of days after which the cookie expires
 * @param {scope} globals
 */
function customSubmitSuccessHandlerWithSettingCookieWithExpiredDays(cookieName, prefillAnswer, expiredDays, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);

    if (cookieName && prefillAnswer) {
        setCookie(cookieName + '=' + prefillAnswer, true, expiredDays * 24 * 60 * 60);
    }
    var response = globals.event.payload.body;
    if (response && response.redirectUrl) {
        redirectToThankYouPage(response.redirectUrl);
    } else {
        console.error("No redirect URL found in the response.");
    }
}

/**
 * baseSwaggerJumpstartFDMSubmitAction
 * @name baseSwaggerJumpstartFDMSubmitAction
 * @param {scope} globals
 */
function baseSwaggerJumpstartFDMSubmitAction(globals) {
    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}

/**
 * baseSwaggerJumpstartFDMSuccessHandler
 * @name baseSwaggerJumpstartFDMSuccessHandler
 * @param {scope} globals
 */
function baseSwaggerJumpstartFDMSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    let response = JSON.parse(globals.event.payload.body);

    var errorResponse = response.data && JSON.parse(response.data.apiResponse);
    if (errorResponse.status === 'SUCCESS') {
        //validates and redirect to thankyou page
        baseURLRedirection(response.data.thankYouPageURL);
    } else {
        baseHandleHDSErrorResponse(response, globals);
    }
}


/**
 * baseBotoxoneManageAccountSuccessHandler
 * @name baseBotoxoneManageAccountSuccessHandler
 * @param {object} apiErrorText
 * @param {object} successText
 * @param {object} passwordInitialStatePanel
 * @param {object} passwordEditPanel
 * @param {scope} globals
 */
function baseBotoxoneManageAccountSuccessHandler(apiErrorText, successText, passwordInitialStatePanel, passwordEditPanel,globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    let response = globals.event.payload.body;

    var errorResponse = response.data && JSON.parse(response.data.apiResponse);
    if (errorResponse.status === 'SUCCESS') {
        //validates and redirect to thankyou page
		globals.functions.setProperty(apiErrorText, {visible: false});
		globals.functions.setProperty(successText, {visible: true});
		globals.functions.setProperty(passwordInitialStatePanel, {visible: true});
        globals.functions.setProperty(passwordEditPanel, {visible: false});
    } else {
        globals.functions.setProperty(apiErrorText, {visible: true});
    }
}

/**
 * linzessRegistrationSuccessHandler
 * @name linzessRegistrationSuccessHandler
 * @param {scope} globals
 */
function linzessRegistrationSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body;
    if (!response.metadata) {
        handleGenericError(globals);
        return;
    }
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        if (typeof fullApiResponse.RegistrationResponse !== 'undefined' && typeof fullApiResponse.RegistrationResponse.PatientDemographic !== 'undefined') {
            var demographicEmail = fullApiResponse.RegistrationResponse.PatientDemographic.Email;
            if (demographicEmail !== 'undefined') {
                sessionStorage.setItem('demographicEmail', demographicEmail);
            }
        }
        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }
        sessionStorage.setItem('linzessGuid', baseUrlGetParam('guid'));
        let cardAction = getSessionStorage('cardAction');
        if (cardAction === 'newCard') {
            sessionStorage.setItem('activateCard', 'newCard');
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
        } else if (cardAction === 'activate') {
            sessionStorage.setItem('activateCard', 'existingCard');
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);
        }
    } else {
        admp_analytics_functions.onFormSubmitError(fullApiResponse);
        if (fullApiResponse.RegistrationResponse) {
            baseHandleErrorResponse(fullApiResponse.RegistrationResponse);
        } else {
            baseHandleErrorResponse(fullApiResponse);
        }
    }
}

/**
 * eApiForgotPasswordFailure
 * @name eApiForgotPasswordFailure
 * @param {object} thankYouPanel
 * @param {object} clickedSubmitButtonField
 * @param {scope} globals
 */
function eApiForgotPasswordFailure(thankYouPanel, clickedSubmitButtonField, globals) {
    $('.submit.button button').prop('disabled', false);
    let errorResponse = globals.event.payload.body;
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);
    if (clickedSubmitButtonField && clickedSubmitButtonField.$value === 'resendEmailButton') {
        let errorCode = Object.keys(errorList[0])[0];
        if (errorCode === '60026') {
            globals.functions.setProperty(thankYouPanel.maxAttemptsError, {visible: true});
            $('button.resendEmail').prop('disabled', true);
            startTimer(60, "minutes", "abbv_timer");
        } else {
            globals.functions.setProperty(thankYouPanel.resendFailureMsg, {visible: true});
        }
    } else {
        bspHandleErrorResponse(errorList, globals);
    }
    admp_analytics_functions.onFormSubmitError(errorResponse);
    globals.functions.setProperty(clickedSubmitButtonField, {value: ''});
}

/**
 * eApiForgotPasswordSuccess
 * @name eApiForgotPasswordSuccess
 * @param {object} thankYouPanel
 * @param {object} resetPasswordPanel
 * @param {object} clickedSubmitButtonField
 * @param {scope} globals
 */
function eApiForgotPasswordSuccess(thankYouPanel, resetPasswordPanel, clickedSubmitButtonField, globals) {
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);
    if (clickedSubmitButtonField && clickedSubmitButtonField.$value === 'resetButton') {
        $('button.botox-reset-button').prop('disabled', false);
        if (fullApiResponse.profileResponse.status === 'true') {
            baseApigeeSuccessAction(response);
            globals.functions.setProperty(thankYouPanel, {visible: true});
            globals.functions.setProperty(resetPasswordPanel, {visible: false});

            startTimer(10, "minutes", "abbv_timer");
            $('.user-email').html(resetPasswordPanel.emailTextBox.$value);
            var interval = setInterval(function () {
                if ($('.abbv_timer p.abbv_countdown').hasClass('abbv_countdown_end')) {
                    globals.functions.setProperty(thankYouPanel.resendEmail, {enabled: true});
                    clearInterval(interval);
                }
            }, 1000);
        } else {
            baseHandleErrorResponse(response);
            admp_analytics_functions.onFormSubmitError(response);
            globals.functions.setProperty(clickedSubmitButtonField, {value: ''});
        }
    } else if (clickedSubmitButtonField && clickedSubmitButtonField.$value === 'resendEmailButton') {
        globals.functions.setProperty(thankYouPanel.resendFailureMsg, {visible: false});
        globals.functions.setProperty(thankYouPanel.maxAttemptsError, {visible: false});
        $('.abbv_timer p.abbv_countdown').removeClass('abbv_countdown_end');
        if (fullApiResponse.profileResponse.status === 'true') {
            baseApigeeSuccessAction(response);
            $('button.resendEmail').prop('disabled', true);
            startTimer(10, "minutes", "abbv_timer");
        } else {
            var errorCode = fullApiResponse.profileResponse.failureResponse[0].code;
            if (errorCode === '60026') {
                globals.functions.setProperty(thankYouPanel.maxAttemptsError, {visible: true});
                $('button.resendEmail').prop('disabled', true);
                startTimer(60, "minutes", "abbv_timer");
            } else {
                globals.functions.setProperty(thankYouPanel.resendFailureMsg, {visible: true});
            }
        }
        var interval = setInterval(function () {
            if ($('.abbv_timer p.abbv_countdown').hasClass('abbv_countdown_end')) {
                $('button.resendEmail').prop('disabled', false);
                clearInterval(interval);
            }
        }, 1000);
    }
}

/**
 * eApiUserProfileSubmitSuccess
 * @name eApiUserProfileSubmitSuccess
 * @param {object} thankYouPanel
 * @param {scope} globals
 */
function eApiUserProfileSubmitSuccess(thankYouPanel, globals) {
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.profileResponse.status === 'true') {
        baseApigeeSuccessAction(response);
        if (thankYouPanel) {
            thankYouPanel.enabled = true;
        } else {
            baseURLRedirection(response.data.thankYouPageURL);
        }
    } else {
        baseHandleErrorResponse(response);
    }
}

/**

 * eApiResetPasswordSubmitSuccess
 * @name eApiResetPasswordSubmitSuccess
 * @param {object} formPanel
 * @param {object} thankyouPanel
 * @param {object} [errorFragment] errorFragment, optional
 * @param {scope} globals
 */
function eApiResetPasswordSubmitSuccess(formPanel, thankyouPanel, errorFragment, globals) {
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.profileResponse.status === 'true') {
        baseApigeeSuccessAction(response);
        globals.functions.setProperty(formPanel, {visible: false});
        globals.functions.setProperty(errorFragment, {visible: false});
        globals.functions.setProperty(thankyouPanel, {visible: true});
    } else {
        baseHandleErrorResponse(response);
    }
}

/**
 * eApiLoginFailure
 * @name eApiLoginFailure
 * @param {scope} globals
 */
function EAPILoginFailure(globals) {
    $('.submit.button button').prop('disabled', false);
    let errorResponse = globals.event.payload.body;
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);

    baseHandleErrorResponse(errorList, globals);
    admp_analytics_functions.onFormSubmitError(errorResponse);
}

/**
 * bspLoginFailure
 * @name bspLoginFailure
 * @param {object} [resetPasswordUrl]
 * @param {scope} globals
 */
function bspLoginFailure(resetPasswordUrl, globals) {
    $('.submit.button button').prop('disabled', false);
    let errorResponse = globals.event.payload.body;
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);
    let errorCode = Object.keys(errorList[0])[0];
    if (errorCode === '60028' && resetPasswordUrl && resetPasswordUrl.$value) {
        window.top.location.href = resetPasswordUrl.$value + "?pwdExpired=true";
    } else {
        bspHandleErrorResponse(errorList, globals)
    }
    admp_analytics_functions.onFormSubmitError(errorResponse);
}

/**
 * If indicationName cookie is missing, then disable the form submission and show session timed out error
 * @name bspSessionTimeoutError
 * @param {String} errCode
 * @param {String} errorMessage error message
 * @param {scope} globals
 */
function bspSessionTimeoutError(errCode, errorMessage, globals) {
    $('.submit.button button').prop('disabled', true); // disabled submit button
    if (!errCode) {
        errCode = "151";
    }
    if (!errorMessage) {
        errorMessage = 'Session timed out. Please retry.';
    }
    // create a custom error message if 'indicationName' cookie not found
    let errorList = [
      {
        [errCode]: errorMessage
      }
    ];
    bspHandleErrorResponse(errorList, globals);
    admp_analytics_functions.onFormSubmitError(errorList);
}

/**
 * showGenericErrorByCode
 * @name showGenericErrorByCode
 * @description add generic-error-fragment in root of the form
 * @param {object} errorList
 * @param {scope} globals
 */
function showGenericErrorByCode(globals, errorList) {
    // Hide all error text components first
    let errorCode = Object.keys(errorList[0])[0];

    const genericErrorFragment = globals.form.$items.find(item =>
        item.$fieldType === 'panel' && item.$name.toLowerCase() === 'generic-error-fragment'
    );

    genericErrorFragment.$items.forEach(item => {
        if(item.$fieldType === 'plain-text' && item.$name.startsWith('err')) {
            globals.functions.setProperty(item, {visible: false});
        }
    });

    // Show the relevant error
    const target = genericErrorFragment.$items.find(item =>
        item.$fieldType === 'plain-text' && item.$name === 'err' + errorCode
    );

    const genericError = genericErrorFragment.$items.find(item =>
        item.$fieldType === 'plain-text' && item.$name.toLowerCase() === 'generic-error-message'
    );

    if(target) {
        globals.functions.setProperty(target, {visible: true});
    } else if (genericError){
        globals.functions.setProperty(genericError, {visible: true});
    } else {
        globals.functions.setProperty(genericErrorFragment, {visible: true});
        // this is to support existing admp-release error fragment implementation
    }
    //scroll to the error fragment
    const $genericError = $('.genericErrorFragment');
    //checks for heaver v2 component
    const isHeaderv2 =  $('.abbv-header-v2').length;
    if ($genericError.length && isHeaderv2) {        
        const offsetHeight = $('.abbv-header-v2-utility-navigation').height() || 0;
        scrollToTarget('.genericErrorFragment',-(offsetHeight));
    }  
}

/**
 * eApiLoginSuccess
 * @name eApiLoginSuccess
 * @param {string} resetPasswordUrl
 * @param {scope} globals
 */
function EAPILoginSuccess(resetPasswordUrl, globals) {
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.profileResponse.status === 'true') {
        baseApigeeSuccessAction(response);
        if (localStorage.getItem(fullApiResponse.profileResponse.profile.email) === 'registered') {
            localStorage.removeItem(fullApiResponse.profileResponse.profile.email);
            setCookie('saml_request_path=' + fullApiResponse.obsUrl, true, 7 * 60 * 60); // TODO nicht vorhanden in response?
        } else {
            setCookie('saml_request_path=' + fullApiResponse.dashboardUrl, true, 7 * 60 * 60); // TODO nicht vorhanden in response?
        }
        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
    } else if (fullApiResponse.profileResponse.failureResponse[0].code === '60028') {
        window.top.location.href = resetPasswordUrl + "?pwdExpired=true";
    } else {
        EAPILoginFailure();
    }
}

/**
 * generateStateToken
 * @name generateStateToken
 * @param {object} panelObj
 * @param {scope} globals
 */
function generateStateToken(panelObj, globals) {
    showLoader(true);

    let recoveryTokenParam = baseUrlGetParam('recoverytoken');
    let inputObject = {
        afData: {
            afUnboundData: {
                data: {
                    transactionName: 'VerifyToken'
                }
            },
            afBoundData: {
                data: {
                    EapiUserProfile: {
                        token: {
                            recoveryToken: recoveryTokenParam !== 'undefined' ? recoveryTokenParam : ''
                        }
                    }
                }
            }
        }
    };

    var getStateTokenSuccess = function (response) {
		var apiResponse = response.apiResponse;
		var jsonResponse = JSON.parse(apiResponse);
        if (jsonResponse.profileResponse.status === 'true') {
            globals.functions.setProperty(panelObj.stateToken, {value: jsonResponse.profileResponse.token.stateToken});
        } else {
            globals.functions.setProperty(panelObj.passwordPanel, {visible: false});
            globals.functions.setProperty(panelObj.recoveryTokenError, {visible: true});
            $('.recovery-token-error').html(jsonResponse.profileResponse.failureResponse[0].message);
        }
        showLoader(false);
    };
    var getStateTokenFailure = function () {
        globals.functions.setProperty(panelObj.passwordPanel, {visible: false});
        globals.functions.setProperty(panelObj.recoveryTokenError, {visible: true});
        showLoader(false);
    };

    let requestObject = {
        formaction: 'UserManagement',
        brandName: 'fm-brandname-botox',
        apiType: 'EAPI',
        version: 'V1',
        originName: baseDetectDeviceType(),
        thankyoupageurl: '',
        'jcr:data': JSON.stringify(inputObject),
    };

    $.ajax({
        url: '/bin/abbvieforms/eapisubmitservlet',
        type: 'POST',
        async: false,
        data: requestObject,
        success: function (response) {
            getStateTokenSuccess(response);
        },
        error: function (xhr, status, error) {
            getStateTokenFailure();
            console.error('unable to fetch profile of the user. get profile api call is failing');
        }
    });
}

/**
 * baseGenerateFullDayCalendarReminder
 * @name baseGenerateFullDayCalendarReminder
 * @param {object} date
 * @param {string} subject
 * @param {string} body
 * @param {scope} globals
 */
function baseGenerateFullDayCalendarReminder(date, subject, body, globals) {
    const validate = globals.functions.validate(date);
    if (validate.length === 0) {
        let payload = {
            date: date.$value,
            subject: subject,
            body: body
        };
        $('<form>', {
            'action': '/bin/abbvieforms/generateics',
            'method': 'post'
        }).append($('<input>', {
            'name': 'data',
            'value': JSON.stringify(payload),
            'type': 'hidden'
        })).appendTo('body').submit().remove();
    }
}

/**
 * baseApigeeSuccessHandler
 * @name baseApigeeSuccessHandler
 * @param {scope} globals
 */
function baseApigeeSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    var response = globals.event.payload.body;
    if (response && response.redirectUrl) {
        baseApigeeSuccessAction(response);
        redirectToThankYouPage(response.redirectUrl);
    } else {
        console.error("No redirect URL found in the response.");
    }
}

/**
 * baseEnrollmentSuccessHandler
 * @name baseEnrollmentSuccessHandler
 * @param {String} insuType
 * @param {scope} globals
 */
function baseEnrollmentSuccessHandler(insuType,globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    var response = globals.event.payload.body;
    if (response && response.redirectUrl) {
        baseApigeeSuccessAction(response);
        redirectToThankYouPage(response.redirectUrl + "?insuType=" + insuType);
    } else {
        console.error("No redirect URL found in the response.");
    }
}

/**
 * lupronPatientRegistrationFragmentSuccessHandler
 * @name lupronPatientRegistrationFragmentSuccessHandler
 * @param {string} insuranceType
 * @param {string} savingCardCheck
 * @param {string} questionAnswer2
 * @param {boolean} sendEmail
 * @param {string} [firstname]
 * @param {string} [emailAddress]
 * @param {scope} globals
 */
function lupronPatientRegistrationFragmentSuccessHandler(insuranceType, savingCardCheck, questionAnswer2, sendEmail, firstname, emailAddress, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;
    var formData = globals.functions.exportData();
    var formRegistrationType = formData.formRegistrationType;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);
    const success = (fullApiResponse.isStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.isStatusSuccessful).toLowerCase() === "true"));
    if (success) {
        localStorage.removeItem("admp_cci");
        if (insuranceType === "1" && savingCardCheck === "1" && fullApiResponse.RegistrationResponse.coPay) {
            localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.RegistrationResponse.coPay));
            if (sendEmail) {
                const cardDetails = {
                    "RxIdentifier": fullApiResponse.RegistrationResponse.coPay.rxIdentifier,
                    "RxGroup": fullApiResponse.RegistrationResponse.coPay.rxGroup,
                    "RxBIN": fullApiResponse.RegistrationResponse.coPay.rxBIN,
                    "RxPCN": fullApiResponse.RegistrationResponse.coPay.rxPCN,
                    "Suf": fullApiResponse.RegistrationResponse.coPay.suf
                };
                var indicationName = baseGetCookieValue('indicationName');
                var finalIndicationPath = '';
                var globalISIPath = '';
                var indicationPath = '';
                if (window.parent.AbbViePageInfo.indicationEndPoints) {
                    indicationPath = window.parent.AbbViePageInfo.indicationEndPoints.inlineUse;
                    finalIndicationPath = indicationPath.substring(0, indicationPath.lastIndexOf('{{'));
                    //Get Inline Full ISI & Condensed ISI Path(For both indication specific & non)
                    globalISIPath = indicationName !== '' ? finalIndicationPath + indicationName : finalIndicationPath;
                    finalIndicationPath += (indicationName || 'generic-indication');
                }
                let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
                var dataObject = {
                    firstname: firstname,
                    emailAddress: emailAddress,
                    emailName: 'savingscard',
                    cardDetails: cardDetails,
                    pagePath: pagePath,
                    finalIndicationPath: finalIndicationPath,
                    globalISIPath: globalISIPath
                };
                sendMail(dataObject, {
                    success: function (response) {
                        console.log("Success");
                    },
                    error: function (error) {
                        console.log("Email Not Sent: " + error);
                    }
                });
            }
        }
        localStorage.setItem('is_patient', 1);
        var prefillAnswer = "No";
        if (questionAnswer2 === "4") {
            prefillAnswer = "Yes";
        }
        setCookie('diagnosed-state', prefillAnswer, true, 365 * 24 * 60 * 60);
        baseApigeeSuccessAction(fullApiResponse.RegistrationResponse);
        (formRegistrationType === 'Registration') ? window.parent.location = window.abbviecloudforms.core.formProperties.registrationthankyoupageurl : window.parent.location = window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl;
    } else {
        let errObj = JSON.parse(response.metadata.fullApiResponse);
        let errorList = extractFormattedErrorDetails(errObj.RegistrationResponse.errorMessages);
        admp_analytics_functions.onFormSubmitError(response);
        baseHandleErrorResponse(errorList, globals);
    }
}

/**
 * linzessActivateSuccessHandler
 * @name linzessActivateSuccessHandler
 * @param {scope} globals
 */
function linzessActivateSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        sessionStorage.removeItem('demographicEmail');
        sessionStorage.removeItem('activateCard');
        localStorage.removeItem('savingcard');
        sessionStorage.removeItem('linzessGuid');
        sessionStorage.removeItem('linzessOptin');
        sessionStorage.removeItem('linzessMobileOptin');
        localStorage.removeItem('admp_cci');
        localStorage.setItem('admp_cci', JSON.stringify(errorResponse.coPay[0]));
        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);
    } else {
        admp_analytics_functions.onFormSubmitError(fullApiResponse);
        if (fullApiResponse.RegistrationResponse) {
            baseHandleErrorResponse(fullApiResponse.RegistrationResponse);
        } else {
            baseHandleErrorResponse(fullApiResponse);
        }
    }
}

/**
 * linzessEapiRegistration
 * @name linzessEapiRegistration
 * @param {scope} globals
 */
function linzessEapiRegistration(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body;
    if (!response.metadata) {
        handleGenericError(globals);
        return;
    }
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);
    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        var encryptedDtls = fullApiResponse.encryptedDetails;
        if (typeof encryptedDtls !== 'undefined' && encryptedDtls.length > 0) {
            var emailId = null;
            for (var i = 0; i < encryptedDtls.length; i++) {
                if (encryptedDtls[i].key === "EmailId") {
                    emailId = encryptedDtls[i].value;
                    break;
                }
            }
            if (emailId !== null) {
                sessionStorage.setItem('demographicEmail', emailId);
            }
        }

        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        let cardAction = getSessionStorage('cardAction');
        if (cardAction === 'newCard') {
            sessionStorage.setItem('activateCard', 'newCard');
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
        } else if (cardAction === 'activate') {
            sessionStorage.setItem('activateCard', 'existingCard');
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);
        }

        sessionStorage.setItem('linzessGuid', baseUrlGetParam('guid'));
    } else {
        handleGenericError(globals);
    }
}

/**
 * linzessSavingsSubmitSuccess
 * @name linzessSavingsSubmitSuccess
 * @param {scope} globals
 */
function linzessSavingsSubmitSuccess(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body;
    if (!response.metadata) {
        handleGenericError(globals);
        return;
    }
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);
    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        var encryptedDtls = fullApiResponse.encryptedDetails;
        if (typeof encryptedDtls !== 'undefined' && encryptedDtls.length > 0) {
            var emailId = null;
            for (var i = 0; i < encryptedDtls.length; i++) {
                if (encryptedDtls[i].key === "EmailId") {
                    emailId = encryptedDtls[i].value;
                    break;
                }
            }
            if (emailId !== null) {
                sessionStorage.setItem('demographicEmail', emailId);
            }
        }

        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }
        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
    } else {
        handleGenericError(globals);
    }
}

/**
 * atogepantPatientRegistrationFragmentSuccessHandler
 * @name atogepantPatientRegistrationFragmentSuccessHandler
 * @param {string} insuranceCoverageType
 * @param {scope} globals
 */
function atogepantPatientRegistrationFragmentSuccessHandler(insuranceCoverageType, globals) {
    var response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);
    if (insuranceCoverageType === "15" && fullApiResponse && fullApiResponse.coPay[0]) {
        localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.coPay[0]));
    }
}

/**
 * atogepantMoonRabbitPatientRegistrationFragmentSuccessHandler
 * @name atogepantMoonRabbitPatientRegistrationFragmentSuccessHandler
 * @param {string} insuranceCoverageType
 * @param {string} savingsCardStatusRadiobutton
 * @param {string} savingsCardIdTextbox
 * @param {string} redirectUrl
 * @param {string} prospectRedirectUrl
 * @param {string} formType
 * @param {scope} globals
 */
function atogepantMoonRabbitPatientRegistrationFragmentSuccessHandler(insuranceCoverageType, savingsCardStatusRadiobutton, savingsCardIdTextbox, redirectUrl, prospectRedirectUrl, formType, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    var response = globals.event.payload.body;
    console.log('guideResultObject: ' + JSON.stringify(response));
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (formType === "Yes") {
        if (fullApiResponse && fullApiResponse.WalletURLs) {
            localStorage.setItem('admp_walletURLs', JSON.stringify(fullApiResponse.WalletURLs));
        }
        console.log("insuranceType:::::" + insuranceCoverageType);
        if (insuranceCoverageType === "15" && savingsCardStatusRadiobutton === "no" && fullApiResponse && fullApiResponse.coPay[0]) {
            localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.coPay[0]));
            window.parent.location = redirectUrl + insuranceCoverageType;
        }
        if (insuranceCoverageType === "15" && savingsCardStatusRadiobutton === "yes") {
            localStorage.setItem('savingsCard_ID', savingsCardIdTextbox);
            window.parent.location = redirectUrl + insuranceCoverageType;
        }
        if (insuranceCoverageType === "16" || insuranceCoverageType === "17" || insuranceCoverageType === "18") {
            localStorage.setItem('savingsCard_ID', savingsCardIdTextbox);
            console.log("thankYouPageURL:::::::", redirectUrl + insuranceCoverageType);
            window.parent.location = redirectUrl + insuranceCoverageType;
        }
    } else if (formType === "No") {
        window.parent.location = prospectRedirectUrl;
    }
}

/**
 * oktaLoginSuccessHandler
 * @name oktaLoginSuccessHandler
 * @param {scope} globals
 */
function oktaLoginSuccessHandler(globals) {
    var response = globals.event.payload.body;
    if (response.data.cookieToken) {
        if (analyticspayload.validPayload) {
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }
        saveHDSUserProfileData(response);
    } else {
        oktaHandleErrorResponse(response.data);
        admp_analytics_functions.onFormSubmitError(response.data.errorCode);
        baseSubmitReset();
    }
}

/**
 * oktaResetSuccessHandler
 * @name oktaResetSuccessHandler
 * @param {scope} globals
 */
function oktaResetSuccessHandler(globals) {
    var response = globals.event.payload.body;
    var apiResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (apiResponse && apiResponse.status == "SUCCESS") {
        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        console.log('--redirecting to thankYouPageURL: ' + JSON.stringify(response));
        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.thankyoupageurl);
    } else {
        oktaHandleErrorResponse(apiResponse);
        console.error('exception while reseting password' + apiResponse.errorSummary);
    }
}


/**
 * apigeeCopayWithoutRegistrationSuccessHandler
 * @name apigeeCopayWithoutRegistrationSuccessHandler
 * @param {scope} globals
 */
function apigeeCopayWithoutRegistrationSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    const formSubmitInfoString = response.metadata.FormSubmitInfo;
    const successKey = "ExecutionStatus=";
    const successStart = formSubmitInfoString.indexOf(successKey) + successKey.length;
    const executionStatus = formSubmitInfoString.substring(successStart, formSubmitInfoString.length - 1);

    if (executionStatus === 'SUCCESS') {
        const cwrResponse = fullApiResponse.GetNextAvailableDocumentNumberWithoutRegistrationResponseBody.GetNextAvailableDocumentNumberWithoutRegistrationResponse.GetNextAvailableDocumentNumberWithoutRegistrationResult;

        const cardDetails = {
            "rxIdentifier": cwrResponse.DocumentNumber,
            "rxGroup": cwrResponse.GroupNumber,
            "rxBIN": cwrResponse.BinNumber,
            "rxPCN": cwrResponse.RxPCN,
            "suf": cwrResponse.RegistrationID
        };
        console.log(cardDetails);

        generatePDFSaving("PDF", cardDetails, "Firstname");
    } else if (executionStatus === 'ERROR') {
        baseHandleErrorResponse(fullApiResponse.GetNextAvailableDocumentNumberWithoutRegistrationResponseBody.GetNextAvailableDocumentNumberWithoutRegistrationResponse.GetNextAvailableDocumentNumberWithoutRegistrationResult.ValidationErrors);
        admp_analytics_functions.onFormSubmitError(fullApiResponse);
    } else {
        admp_analytics_functions.onFormSubmitError(regResponse);
        handleGenericError(globals);
    }
}

/**
 * apigeeCopayWithoutRegistrationErrorHandler
 * @name apigeeCopayWithoutRegistrationErrorHandler
 * @param {scope} globals
 */
function apigeeCopayWithoutRegistrationErrorHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    const response = globals.event.payload.body;
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);
    baseHandleErrorResponse(errorList, globals);
    admp_analytics_functions.onFormSubmitError(response);
}

/**
 * eapiGenerateDirectCopaySuccessHandler
 * @name eapiGenerateDirectCopaySuccessHandler
 * @param {scope} globals
 */
function eapiGenerateDirectCopaySuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    const formSubmitInfoString = response.metadata.FormSubmitInfo;
    const successKey = "IsStatusSuccessful=";
    const successStart = formSubmitInfoString.indexOf(successKey) + successKey.length;
    const successStatus = formSubmitInfoString.substring(successStart, formSubmitInfoString.length - 1);

    if (successStatus === 'true') {
        const coPay = fullApiResponse.coPay[0];
        const cardDetails = {
            "rxIdentifier": coPay.rxIdentifier,
            "rxGroup": coPay.rxGroup,
            "rxBIN": coPay.rxBIN,
            "rxPCN": coPay.rxPCN,
            "suf": coPay.suf
        };
        console.log(cardDetails);

        generatePDFSaving("PDF", cardDetails, "Firstname");
    } else {
        eApiRegistrationFailure(globals);
    }
}

/**
 * skyriziWelcomeSurveySaveAssessmenSubmitAction
 * Submit action for Skyrizi Welcome Survey Save Assessment
 * @name skyriziWelcomeSurveySaveAssessmenSubmitAction
 * @param {scope} globals
 */
function skyriziWelcomeSurveySaveAssessmenSubmitAction(globals) {
    var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
    var jsondata = globals.functions.exportData();
    proxyApigeeData = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        actionType: 'brandAPI',
        originName: baseDetectDeviceType(),
        version: 'V1',
        formRequest: 'Yes',
    };

    var baseSurveySubmitSuccess = function (response) {
        requestBody = JSON.stringify(jsondata.SaveAssessmentContent);
        //var errorResponse = response.data && JSON.parse(response.data.apiResponse);
        if (response.IsStatusSuccessful) {
            analyticsFormSubmitEvent(requestBody);
            window.parent.location = window.abbviecloudforms.core.formProperties.registrationthankyoupageurl;
        } else {
            baseHandleHDSErrorResponse(errorResponse, globals);
        }
    };

    var baseSurveySubmitActionFailure = function (response) {
        baseHandleHDSErrorResponse(response, globals);
    };

    proxyApigeeData.payload = JSON.stringify(jsondata.SaveAssessmentContent);
    proxyApigeeData.formAction = 'SaveAssessmentContent';
    showLoader(true);
    window.parent.scrollTo(0, $('.cmp-load-div').height());
    baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, baseSurveySubmitSuccess, baseSurveySubmitActionFailure);
}


/**
 * @name fetzimaEapiRegistrationSuccessHandler
 * @param {scope} globals
 */
function fetzimaEapiRegistrationSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    var response = globals.event.payload.body;
    if (!response.metadata) {
        handleGenericError(globals);
        return;
    }
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);
    if (fullApiResponse.isStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        var encryptedDtls = fullApiResponse.encryptedDetails;
        if (typeof encryptedDtls !== 'undefined' && encryptedDtls.length > 0) {
            var emailId = null;
            for (var i = 0; i < encryptedDtls.length; i++) {
                if (encryptedDtls[i].key === "EmailId") {
                    emailId = encryptedDtls[i].value;
                    break;
                }
            }
            if (emailId !== null) {
                sessionStorage.setItem('demographicEmail', emailId);
            }
        }

        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        const action = sessionStorage.getItem('cardAction');
        if (action === 'newCard') {
            sessionStorage.setItem('activateCard', 'newCard');
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.thankyoupagedualone);
        } else {
            sessionStorage.setItem('activateCard', 'existingCard');
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.thankyoupagedualtwo);
        }
        sessionStorage.setItem('fetzimaGuid', baseUrlGetParam('guid'));
    } else {
        handleGenericError(globals);
    }
}

/**
 * @name fetzimaSubmit
 * @param {boolean} isNewCard boolean true if new card, false for activate
 * @param {string} campaignKey
 * @param {object} hiddenCampaignsObj
 * @param {scope} globals
 */
function fetzimaSubmit(isNewCard, campaignKey, hiddenCampaignsObj, globals) {
    const formData = baseCreateJsonArrayForEAPICampaigns(campaignKey, hiddenCampaignsObj, globals);
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        if (isNewCard) {
            sessionStorage.setItem('cardAction', 'newCard');
        } else {
            sessionStorage.setItem('cardAction', 'activate');
        }
       fetchObservabilityAndSubmit(globals, formData);
    }
}


/**
 * Base PSA Dsa Registration Part One SuccessHandler
 * @name basePSADsaRegistrationPartOneSuccessHandler
 * @param {scope} globals
 */
function basePSADsaRegistrationPartOneSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body || {};
    const fullApiResponseString = response.metadata.fullApiResponse || {};
    const fullApiResponse = JSON.parse(fullApiResponseString);
    //converting errorResponse.RegistrationResponse.IsStatusSuccessful into string because of inconsistent api response
    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        if (typeof fullApiResponse.RegistrationResponse !== 'undefined' && typeof fullApiResponse.RegistrationResponse.ContentResult.ConsumerId !== 'undefined') {
            var consumerId = fullApiResponse.RegistrationResponse.ContentResult.ConsumerId;
            if (consumerId) {
                sessionStorage.setItem('consumerId', consumerId);
            }
        }
        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        if (response.data && response.data.thankYouPageURL) {
            baseURLRedirection(response.data.thankYouPageURL);
        } else {
            redirectToThankYouPage(response.redirectUrl);
        }

    } else {
        admp_analytics_functions.onFormSubmitError(fullApiResponse);
        if (fullApiResponse.RegistrationResponse) {
            baseHandleErrorResponse(fullApiResponse.RegistrationResponse);
        } else {
            baseHandleErrorResponse(fullApiResponse);
        }
    }
}

/**
 * Base PSA Dsa Registration Part Two SuccessHandler
 * @name basePSADsaRegistrationPartTwoSuccessHandler
 * @param {scope} globals
 */
function basePSADsaRegistrationPartTwoSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);

    var response = globals.event.payload.body || {};
    const fullApiResponseString = response.metadata.fullApiResponse || {};
    const fullApiResponse = JSON.parse(fullApiResponseString);
    //converting errorResponse.RegistrationResponse.IsStatusSuccessful into string because of inconsistent api response
    if (fullApiResponse.IsStatusSuccessful || (fullApiResponse.RegistrationResponse && String(fullApiResponse.RegistrationResponse.IsStatusSuccessful).toLowerCase() === "true")) {
        if (analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        if (response.data && response.data.thankYouPageURL) {
            baseURLRedirection(response.data.thankYouPageURL);
        } else {
            redirectToThankYouPage(response.redirectUrl);
        }

    } else {
        admp_analytics_functions.onFormSubmitError(fullApiResponse);
        if (fullApiResponse.RegistrationResponse) {
            baseHandleErrorResponse(fullApiResponse.RegistrationResponse);
        } else {
            baseHandleErrorResponse(fullApiResponse);
        }
    }
}


/**
 * basePSADSAStep2PrefillData
 * @name basePSADSAStep2PrefillData
 * @param {scope} globals
 */
function basePSADSAStep2PrefillData(globals) {
    const currentField = globals.event.target;
    const hiddenPanel = currentField.hiddenPanel;
    var psaRegCookie = baseGetCookieValue('admp_PSARegistration');
    if (psaRegCookie) {
            // Decrypt the cookie value
            var requestDetails = getDecryptedvalue('admp_PSARegistration');

            if (requestDetails) {
                if (hasValue(requestDetails.firstName)) {
                    globals.functions.setProperty(hiddenPanel.firstName, {
                        value: requestDetails.firstName
                    });
               }

                if (hasValue(requestDetails.lastName)) {
                    globals.functions.setProperty(hiddenPanel.lastname, {
                        value: requestDetails.lastName
                    });
                }

                if (hasValue(requestDetails.emailId)) {
                    globals.functions.setProperty(hiddenPanel.EmailAddress, {
                        value: requestDetails.emailId
                    });
                }
                globals.functions.setProperty(hiddenPanel.responseText7, {
                    value: sessionStorage.getItem('consumerId')
                });
            }
    }
}

/**
 * synthroidEapiSuccessHandler
 * @name synthroidEapiSuccessHandler
 * @param {object} formPanel
 * @param {object} thankyouPanel
 * @param {object} intresteinInRadioButton
 * @param {object} prescribedRadioButton
 * @param {scope} globals
 */
function synthroidEapiSuccessHandler(formPanel, thankyouPanel, prescribedRadioButton, intresteinInRadioButton, globals) {
    const response = globals.event.payload.body;
    const fullApiResponseString = response.metadata.fullApiResponse;
    const fullApiResponse = JSON.parse(fullApiResponseString);

    if (fullApiResponse.isStatusSuccessful === 'true') {
        baseApigeeSuccessAction(response);
        let prescribedRadioValue = prescribedRadioButton.$value;
        let intrestedRadioValue = intresteinInRadioButton.$value;
        globals.functions.setProperty(formPanel, {visible: false});
        if (prescribedRadioValue === '1' && intrestedRadioValue === '2') {
            globals.functions.setProperty(thankyouPanel.panel1, {visible: true});
        } else if (prescribedRadioValue === '1' && intrestedRadioValue === '1') {
            localStorage.removeItem('admp_cci');
            localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.coPay[0]));
            globals.functions.setProperty(thankyouPanel.panel2, {visible: true});
            var userAgent = navigator.userAgent;
            if (/android/i.test(userAgent)) {
                globals.functions.setProperty(thankyouPanel.panel2.googleWalletText, {visible: true});
                globals.functions.setProperty(thankyouPanel.panel2.appleWalletText, {visible: false});
            } else if (/iPhone/.test(userAgent) && !userAgent.includes('Macintosh')) {
                globals.functions.setProperty(thankyouPanel.panel2.googleWalletText, {visible: false});
                globals.functions.setProperty(thankyouPanel.panel2.appleWalletText, {visible: true});
            } else {
                globals.functions.setProperty(thankyouPanel.panel2.googleWalletText, {visible: false});
                globals.functions.setProperty(thankyouPanel.panel2.appleWalletText, {visible: false});
            }
            baseQRcodeInThankyouPanel('qrimage', thankyouPanel.panel2.qrCodeWidth, thankyouPanel.panel2.qrCodeUrl, globals);
            $(function () {
                $('.addtowallet').on('click', function () {
                    window.parent.location = this.href;
                });
            });
        } else if (prescribedRadioValue === '2') {
            globals.functions.setProperty(thankyouPanel.panel3, {visible: true});
        } else if (prescribedRadioValue === '3') {
            globals.functions.setProperty(thankyouPanel.panel4, {visible: true});
        } else if (prescribedRadioValue === '4') {
            globals.functions.setProperty(thankyouPanel.panel5, {visible: true});
        }
    } else {
        eApiRegistrationFailure(globals);
    }
}

/**
 * customDSASubmitSuccessFormPanelHandler
 * @name customDSASubmitSuccessFormPanelHandler
 * @param {object} formPanel
 * @param {object} thankyouPanel
 * @param {object} [errorFragment] errorFragment, optional
 * @param {scope} globals
 */
function customDSASubmitSuccessFormPanelHandler(formPanel, thankyouPanel, errorFragment, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    const response = globals.event.payload.body;
    if (response) {
        globals.functions.setProperty(formPanel, {visible: false});
        globals.functions.setProperty(errorFragment, {visible: false});
        globals.functions.setProperty(thankyouPanel, {visible: true});
    } else {
        console.error("No response found in the payload.");
    }
}

/**
 * @name eapiOnSubmit
 * @param {string} campaignKey
 * @param {object} hiddenCampaignsObj
 * @param {scope} globals
 */
function eapiOnSubmit(campaignKey, hiddenCampaignsObj, globals) {
    const formData = baseCreateJsonArrayForEAPICampaigns(campaignKey, hiddenCampaignsObj, globals);
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}

/**
 * quliptaDDGSubmitSuccess
 * @name quliptaDDGSubmitSuccess
 * @param {object} email
 * @param {object} [emailSuccessPanel] success panel will be visible after email is sent, if no redirect is triggered, optional
 * @param {object} [sendNowButton] button to send email, will be hidden after email is sent, optional
 * @param {object} [recaptcha] recaptcha object, will be hidden after email is sent, optional
 * @param {object} [pdfPanel] pdf panel object, will be hidden after email is sent, optional
 * @param {object} [summaryPanel] summary panel object, will be hidden after email is sent, optional
 * @param {object} [thankYouPanel]
 * @param {scope} globals
 */
function quliptaDDGSubmitSuccess(thankYouPanel, email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    const successKey = "IsStatusSuccessful=";
    const successStart = jsonString.indexOf(successKey) + successKey.length;
    const successEnd = jsonString.indexOf("}", successStart);
    const isStatusSuccessful = jsonString.substring(successStart, successEnd);
    if (isStatusSuccessful === 'true') {
        ddgQuizSendEmailWithoutRedirectExtended(email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals);
        baseApigeeSuccessAction(response);
        if (thankYouPanel) {
            globals.functions.setProperty(thankYouPanel, {visible: true});
        } else {
            baseURLRedirection(window.abbviecloudforms.core.formProperties.thankyoupageurl, globals);
        }
    } else {
        eApiRegistrationFailure(globals);
    }
}

/**
 * @name costAndCovershowHide
 * @param {string} className
 */
function costAndCovershowHide(className) {
    var domContainer = $(window.parent.document);
    domContainer.find('.costandcoverage-container').hide();
    if (className === 'costandcoverage-container') {
        domContainer.find('.costandcoverage-container').hide();
    } else if (className !== "") {
        domContainer.find('.costandcoverage-container' + className).show();
    }
}

function defaultHideContainer() {
    if (window.location.href.indexOf('/editor.html') < 0) {
        costAndCovershowHide("");
    }
}

/**
 * @name costAndCoverGenerateClassname
 * @param {string} condition
 @param {string} insurance
 */
function costAndCoverGenerateClassname(condition, insurance) {
    if (insurance === 'i4') {
        costAndCovershowHide('.c1-i4');
    } else {
        var dynamicClassName = '.' + condition + '-' + insurance;
        costAndCovershowHide(dynamicClassName);
    }
}

/**
 * baseBeforeAfterPortalSubmitSuccessHandler
 * @name baseBeforeAfterPortalSubmitSuccessHandler
 * @param {string} [dynamicEmailSubjectsInternal] dynamicEmailSubjectsInternal (optional)
 * @param {string } [dynamicEmailSubjectsExternal] dynamicEmailSubjectsExternal (optional)
 * @param {scope} globals
 */
function baseBeforeAfterPortalSubmitSuccessHandler(dynamicEmailSubjectsInternal, dynamicEmailSubjectsExternal, globals) {
    let myArray = window.parent.AbbViePageInfo.runModes.split(',');
    let emailAdd = '';
    if (myArray[0] === 'prod') {
        emailAdd = $('.email-address').find('input').val();
    } else {
        emailAdd = "kana@mailinator.com";
    }
    let emailAddCust = $('.email-customer').find('input').val();
    let pagePath = window.parent.AbbViePageInfo ? window.parent.AbbViePageInfo.pagepath : '';
    passDDGQuestions(globals);
    try {
        if (emailAdd.trim()) {
            generateEmailPayloadHCP(emailAdd, pagePath, false);
            if (dynamicEmailSubjectsInternal) {
                finalPayload.dynamicEmailSubjects = JSON.stringify(dynamicEmailSubjectsInternal);
            }
            generateDdgQuizEmail(emailAdd, 'ddg', pagePath, false);
            if (finalPayload.dynamicEmailSubjects) {
                delete finalPayload.dynamicEmailSubjects;
            }
        }
        if (emailAddCust) {
            generateEmailPayloadHCP(emailAdd, pagePath, false, true);
            if (dynamicEmailSubjectsExternal) {
                finalPayload.dynamicEmailSubjects = JSON.stringify(dynamicEmailSubjectsExternal);
            }
            generateDdgQuizEmail(emailAddCust, 'ddg', pagePath, false);
        }
    } catch (error) {
        console.error('Error in sending email');
    }
    window.parent.location = window.abbviecloudforms.core.formProperties.thankyoupageurl;
}

/**
 * @name createImageMetadataPayload
 * @param {object} beforeImage
 * @param {object} beforeImageMetadata
 * @param {object} afterImage
 * @param {object} afterImageMetadata
 * @param {scope} globals
 */
function createImageMetadataPayload(beforeImage, beforeImageMetadata, afterImage, afterImageMetadata, globals) {
    let url;
    let combinedMetadata;
// before images
    let $fileUploadBefore = $('.scheduleAPanel-' + baseGetCookieValue('brandName') + ' .file_upload_before');
    if ($fileUploadBefore.find('input[name="uploadedFiles"]').val().length !== 0) {
        combinedMetadata = '';
        url = '';
        $fileUploadBefore.find('div[class="file-status"]').each(function (j, el) {
            if (url) {
                url += '&#124;';
            }
            url += $(el).find('input[name="awsPath"]').val();

            if (combinedMetadata) {
                combinedMetadata += '&#124;';
            }
            let metadata = '';
            $(el).find('label[class*="fileinfo-meta"]').each(function (k, element) {
                if (metadata) {
                    metadata += ',';
                }
                let $inputElement = $(element).children('input');
                metadata += $inputElement.attr('name') + ':' + $inputElement.val();
            });
            combinedMetadata += metadata;
        });
        globals.functions.setProperty(beforeImage, {value: url});
        globals.functions.setProperty(beforeImageMetadata, {value: combinedMetadata});
    }

    // after images
    let $fileUploadAfter = $('.scheduleAPanel-' + baseGetCookieValue('brandName') + ' .file_upload_after');
    if ($fileUploadAfter.find('input[name="uploadedFiles"]').val().length !== 0) {
        combinedMetadata = '';
        url = '';
        $fileUploadAfter.find('div[class="file-status"]').each(function (j, el) {
            if (url) {
                url += '&#124;';
            }
            url += $(el).find('input[name="awsPath"]').val();

            if (combinedMetadata) {
                combinedMetadata += '&#124;';
            }
            let metadata = '';
            $(el).find('label[class*="fileinfo-meta"]').each(function (k, element) {
                if (metadata) {
                    metadata += ',';
                }
                let $inputElement = $(element).children('input');
                metadata += $inputElement.attr('name') + ':' + $inputElement.val();
            });
            combinedMetadata += metadata;
        });
        globals.functions.setProperty(afterImage, {value: url});
        globals.functions.setProperty(afterImageMetadata, {value: combinedMetadata});
    }
}

/**
 * Initialize registration success message and auto-fill inputs
 *
 * @param {object} registrationSuccessText
 * @param {object} usemyRadioButton
 * @param {object} mobileNumberTextbox
 * @param {object} emailTextbox
 * @param {scope} globals
 */
function initializeRegistrationAndRememberMe(
    registrationSuccessText,
    usemyRadioButton,
    mobileNumberTextbox,
    emailTextbox, globals
) {

    // Handle registration success message
    if (getSessionStorage('from_registration') === 'true') {
        globals.functions.setProperty(registrationSuccessText, {visible: true});
        globals.functions.setProperty(usemyRadioButton, {visible: false});
        sessionStorage.removeItem('from_registration');
    }

    if (
        usemyRadioButton.value === 'PhoneNumber' &&
        baseGetCookieValue('botox_login_rememberphone')
    ) {
        mobileNumberTextbox.value =
            baseGetCookieValue('botox_login_rememberphone');

    } else if (
        usemyRadioButton.value === 'Email' &&
        baseGetCookieValue('botox_login_rememberemail')
    ) {
        emailTextbox.value =
            baseGetCookieValue('botox_login_rememberemail');
    }
}

/**
 * botoxLoginSuccess
 * @name botoxLoginSuccess
 * @param {scope} globals
 */
function botoxLoginSuccess(globals) {
    const response = globals.event.payload.body;
    const errorResponse = response.metadata && JSON.parse(response.metadata.fullApiResponse);
    if (errorResponse.profileResponse.status === 'true') {
        baseApigeeSuccessAction(errorResponse);
        localStorage.setItem('firstLogin', 'true');
        localStorage.setItem('dashboardUrl', errorResponse.dashboardUrl);
        localStorage.setItem('prospectDashboardRedirect', errorResponse.prospectDashboardRedirect);
        localStorage.setItem('patientDashboardRedirect', errorResponse.patientDashboardRedirect);
        if (errorResponse.dashboardRedirect !== null && errorResponse.dashboardRedirect === 'true') {
            localStorage.setItem('dashboardRedirect', errorResponse.dashboardRedirect);
        }
        if (errorResponse.completeDashboardUrl !== null) {
            localStorage.setItem('completeDashboardUrl', errorResponse.completeDashboardUrl);
        }
        if (errorResponse.profileResponse.patientId) {
            localStorage.setItem('patientId', errorResponse.profileResponse.patientId);
        }
        if (errorResponse.profileResponse.additionalPatientId) {
            localStorage.setItem('additionalPatientId', errorResponse.profileResponse.additionalPatientId);
        }
        if (localStorage.getItem(errorResponse.profileResponse.profile.email) === 'registered') {
            localStorage.removeItem(errorResponse.profileResponse.profile.email);
            setCookie('saml_request_path', errorResponse.obsUrl, true, 7 * 60 * 60);
        } else {
            setCookie('saml_request_path', errorResponse.dashboardUrl, true, 7 * 60 * 60);
        }
        window.top.location.href = errorResponse.redirectUrl;
    } else if (errorResponse.profileResponse.failureResponse[0].code === '60028') {
        window.top.location.href = resetPasswordURL.value + "?pwdExpired=true";
    } else {
        EAPILoginFailure(errorResponse.profileResponse);
    }
}

/**
 * @name botoxOnSubmit
 * @param {string} campaignKey
 * @param {object} hiddenCampaignsObj
 * @param {object} guidePanel
 * @param {scope} globals
 */
function botoxOnSubmit(campaignKey, hiddenCampaignsObj, guidePanel, globals) {
    const formData = baseCreateJsonArrayForEAPICampaigns(campaignKey, hiddenCampaignsObj, globals);
    if (guidePanel.user.usemyRadioButton.$value === 'Email' && guidePanel.user.emailTextbox.$value && guidePanel.credentials.section.rememberMeCheckBox.$value) {
        setCookie('botox_login_rememberemail', guidePanel.user.emailTextbox.$value, true, 7 * 60 * 60);
    }
    if (guidePanel.user.usemyRadioButton.$value === 'PhoneNumber' && guidePanel.user.mobileNumberTextbox.$value && guidePanel.credentials.section.rememberMeCheckBox.$value) {
        setCookie('botox_login_rememberphone', guidePanel.user.mobileNumberTextbox.$value, true, 7 * 60 * 60);
    }
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}


/**
 * baseHDSRegistrationSuccessHandler
 * @name baseHDSRegistrationSuccessHandler
 * @param {scope} globals
 */
function baseHDSRegistrationSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    var cookieLife = 7 * 60 * 60;
    setCookie('admp_hdsUser', 'true', true, cookieLife);
    localStorage.removeItem('MaxedgeCID');
    baseURLRedirection(window.abbviecloudforms.core.formProperties.thankyoupageurl);
}

/**
 * baseHDSRegistrationErrorHandler
 * @name baseHDSRegistrationErrorHandler
 * @param {scope} globals
 */
function baseHDSRegistrationErrorHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    var payload = JSON.parse(globals.event.payload.body);
    var errorList = extractErrorCodes(payload);
    if (!Array.isArray(errorList) || errorList.length === 0) {
        handleGenericError(globals);
    } else {
        handleFieldError(errorList, globals);
    }
    admp_analytics_functions.onFormSubmitError(errorList);
}


/**
 * humiraSubmission
 * @name humiraSubmission
 * String signupSuccessUrl
 * @param {scope} globals
 */
function humiraSubmission(signupSuccessUrl, globals) {
    var formData = globals.functions.exportData();
    var additionalJSON = {
        "AmbassadorEnrollmentDetails": {
            "ConsumerPhone": {
                "VoiceMessageOptIn": "false",
                "BestTimeToCall": ""
            }
        }
    };
    var addunbounddata = JSON.stringify(additionalJSON);
    showLoader(true);
    var contentPath = $('.cmp-adaptiveform-container').find("form").attr('data-cmp-path');
    contentPath = contentPath.substr(12, contentPath.length);
    $.ajax({
        url: "/bin/abbvieforms/humirasubbmission",
        type: "POST",
        //async: false,
        data: {
            "formdata": JSON.stringify(formData),
            "additionalUnboundData": addunbounddata,
            "resourceAF": contentPath,
            "origin": baseDetectDeviceType(),
            "brandName": "fm-brandname-humira"
        },
        success: function (res) {
            showLoader(false);
            debugger;
            var resultStr = JSON.parse(res);
            if (resultStr.IsStatusSuccessful) {
                window.parent.location.href = signupSuccessUrl;
            } else if (resultStr.IsStatusSuccessful === "serverValidateFail") {
                handleGenericError(globals);
            } else {
                baseHandleErrorResponse(resultStr);
            }
        },
        error: function (message) {
            console.log("Ajax call failed");
        }
    });

    if (analyticspayload.validPayload) {
        analyticspayload.getFormCompletePayload();
    } else {
        analyticsFormSubmitEvent(requestBody);
    }
}

/**
 * eapiCreonSubmitSuccess
 * @name eapiCreonSubmitSuccess
 * @param {object} [thankYouPanel]
 * @param {scope} globals
 */
function eapiCreonSubmitSuccess(thankYouPanel, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    if (globals.event.payload && globals.event.payload.body) {
        const response = globals.event.payload.body;
        const jsonString = globals.event.payload.body.metadata.fullApiResponse;
        const jsonData = JSON.parse(jsonString);
            updateCopayDataInLocalStorage(jsonData);
        if (jsonData.isStatusSuccessful === 'true') {
            baseApigeeSuccessAction(response);
            if (thankYouPanel) {
                globals.functions.setProperty(thankYouPanel, {visible: true});
            } else {
                baseURLRedirection(window.abbviecloudforms.core.formProperties.thankyoupageurl, globals);
            }
        } else {
            eApiRegistrationFailure(globals);
        }
    }
}

function updateCopayDataInLocalStorage(jsonData) {
    for (const mainkey in jsonData) {
        if (mainkey === "coPay") localStorage.setItem("admp_cci", JSON.stringify(jsonData[mainkey][0])); if (mainkey != "isStatusSuccessful" && mainkey != "patientId") {
            var copayVal = jsonData[mainkey];
            var copay = Array.isArray(copayVal) ? copayVal : [copayVal];
            console.log(copay);
            for (var key in copay) {
                if (copay.hasOwnProperty(key)) {
                    console.log(copay[key]);
                    var capoData = Object.entries(copay[key]);
                    capoData.forEach((data, i) => {
                        if (data[0] !== "isSuccess") {
                            localStorage.setItem(data[0], data[1]);
                        }
                    });
                }
            }
        } else { localStorage.setItem(mainkey, jsonData[mainkey]) }
    }
}

/**
 * @name baseOktaLogin
 * @param {string} username
 * @param {string} password
 * @param {scope} globals
 */
function baseOktaLogin(username, password, globals) {
    const errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
    }

    const jcrData = encodeURIComponent(JSON.stringify({
        afData: {
            afBoundData: {
                data: {
                    Session: {
                        username: username,
                        password: password
                    }
                }
            }
        }
    }));

    $.ajax({
        url: '/bin/abbvieforms/api/okta?jcr:data=' + jcrData,
        method: "post",
        async: false,
        data: {
            brandName: window.abbviecloudforms.core.formProperties.brandName,
            formaction: 'Login',
            version: window.abbviecloudforms.core.formProperties.version,
        }
    }).done(function (data) {
        if (data && data.errorCode) {
            admp_analytics_functions.onFormSubmitError();
            $('.submit.button button').prop('disabled', false);
            //This is data '{"errorCode":"E0000004","errorSummary":"Authentication failed"}'
            //Need to transform to this: [{"E0000004":"Authentication failed"}]
            let errorList = [];
            let obj = {};
            obj[data.errorCode] = data.errorSummary;
            errorList.push(obj);
            handleFieldError(errorList, globals);
            console.log(data);
        } else {
            onSubmitCompleteAnalytics(globals);
            baseHDSSaveUserProfileData(data);
            $('.submit.button button').prop('disabled', false);
        }
    }).fail(function (jqXHR, textStatus, errorThrown) {
        admp_analytics_functions.onFormSubmitError();
        $('.submit.button button').prop('disabled', false);
        console.log(jqXHR);
        console.log(textStatus);
        console.log(errorThrown);
    });
}

function baseHDSSaveUserProfileData(response) {
    const cookieLife = 7 * 60 * 60;

    //Ignore the api cookie age - set it to 12 minutes, so that browser deletes it before token expires on server (15 min)
    setCookie('admp_login_token', response.id, true, 720);

    setCookie('admp_login_email', response.login, true, cookieLife);
    setCookie('admp_login_userid', response.userId, true, cookieLife);
    setCookie('admp_ufln', response._links.user.name, true, cookieLife);
    setCookie('admp_login_type', 'okta', true, cookieLife);
    setCookie('admp_login_brandname', window.abbviecloudforms.core.formProperties.brandName, true, cookieLife);
    let hdsUser = response.hdsUser;
    setCookie('admp_hdsUser', hdsUser, true, cookieLife);
    setCookie('admp_nonHdsUserRedirect', response.registrationUrl, true, cookieLife);
    if (response && response.admp_gp_atoken) {
        localStorage.setItem('admp_tpd', response.admp_gp_atoken);
        if (response.id) {
            localStorage.setItem('admp_jeess_per', response.admp_jeess_per);
        }
        if (response.admp_pkcue) {
            localStorage.setItem('admp_pkcue', response.admp_pkcue);
        }
        if (response.admp_pkcue_frm) {
            localStorage.setItem('admp_pkcue_frm', response.admp_pkcue_frm);
        }
        if (response.admp_pkcue_n_frm) {
            localStorage.setItem('admp_pkcue_n_frm', response.admp_pkcue_n_frm);
        }
        if (response.educationUrl) {
            localStorage.setItem('educationUrl', response.educationUrl);
        }
        //Decrypt admp_tpd response and set cookie
        decryptResponseGcm('admp_tpd').then(function (decryptedData) {
            var decryptedDataJson = JSON.parse(decryptedData);
            if (decryptedDataJson) {
                if (decryptedDataJson.status == 'SUCCESS') {
                    var lmsUserId = decryptedDataJson.content.lmsUserId;
                    if(decryptedDataJson.content.hasOwnProperty('lmsUserId') && (lmsUserId && lmsUserId !== 'null')) {
                        setCookie('lmsUserId', lmsUserId, true, cookieLife);
                        setLoginRedirection(decryptedDataJson, response, cookieLife);
                    } else if (localStorage.getItem('onlineEducation')) {
                        getlmsUserId(decryptedDataJson, response, cookieLife);
                    } else {
                        setLoginRedirection(decryptedDataJson, response, cookieLife);
                    }
                }
            }
        });
    }
}
// If lmsUserId is not available in getProfile response, call HDS API createLMSUser to create the LMS user id
function getlmsUserId(decryptedDataJson, response, cookieLife) {
    var oktaUserIdVal = baseGetCookieValue('admp_login_userid');
    var brandName = baseGetCookieValue('admp_login_brandname');
    var updatePayload = { oktaUserId: oktaUserIdVal };
    $.ajax({
        url: '/bin/abbvieforms/api/okta',
        method: 'post',
        async: false,
        data: {
            brandName: brandName,
            formaction: 'CreateLMSUser',
            version: 'V1',
            data: JSON.stringify(updatePayload)
        }
    }).done(function(data) {
        if (data.status === 'SUCCESS' && data.data.lmsUserId) {
            setCookie('lmsUserId', data.data.lmsUserId, cookieLife);
            setLoginRedirection(decryptedDataJson, response, cookieLife);
        } else {
            window.top.location.href = response.educationUrl;
        }
    }).fail(function(error) {
        window.top.location.href = response.educationUrl;
    });
}

//Based on the getProfile response, redirecting to the dashboard/update-profile/LMS page
function setLoginRedirection(decryptedDataJson, response, cookieLife) {
    var userCta = baseUrlGetParam('cid');
    var practice = decryptedDataJson.content.practice;
    var maxUser = decryptedDataJson.content.practice.maxedgeUser;
    var userIndication = decryptedDataJson.content.indication;
    var userIndNPI = decryptedDataJson.content.practice.individualNpi;
    var redirectionUrl;
    if (localStorage.getItem('onlineEducation')) {
        localStorage.removeItem('onlineEducation');
        redirectionUrl = response.educationUrl;
    } else {
        redirectionUrl = response.dashboardUrl;
    }
    if (practice.hasOwnProperty('maxedgeUser')) {
        setCookie('admp_maxedgeUser', maxUser, true, cookieLife);
        if (userIndication && userIndication !== 'null') {
            setCookie('admp_indication', userIndication, true, cookieLife);
        }
        if (userIndNPI && userIndNPI !== 'null') {
            setCookie('admp_individualNpi', userIndNPI, true, cookieLife);
        }
        if (userCta) {
            setCookie('admp_response_cid', userCta, true, cookieLife);
            if (decryptedDataJson.content.indication && decryptedDataJson.content.practice.individualNpi) {
                if (decryptedDataJson.content.practice.maxedgeUser == 'out') {
                    let brandName = baseGetCookieValue('admp_login_brandname');
                    let userSessionId = baseGetCookieValue('admp_login_token');
                    let userId = baseGetCookieValue('admp_login_userid');
                    let updatePayload = {
                        userSessionId: userSessionId,
                        individualNpi: userIndNPI,
                        maxedgeUser: 'in',
                        ctaId: userCta,
                        indication: userIndication,
                        modeOfContact: ''
                    };
                    $.ajax({
                        url: '/bin/abbvieforms/api/okta',
                        method: 'post',
                        async: false,
                        data: {
                            brandName: brandName,
                            formaction: 'MaxEdgeUpdateProfile',
                            version: 'V1',
                            userId: userId,
                            data: JSON.stringify(updatePayload)
                        }
                    }).done(function (data) {
                        setCookie('saml_request_path', redirectionUrl, true, cookieLife);
                    }).fail(function (error) {
                        console.error('Update maxedgeUser failed');
                    });
                } else {
                    setCookie('saml_request_path', redirectionUrl, true, cookieLife);
                }
            } else {
                setCookie('saml_request_path', response.updateProfileUrl, true, cookieLife);
            }
        } else {
            if (!decryptedDataJson.content.indication || !decryptedDataJson.content.practice.individualNpi) {
                setCookie('saml_request_path', response.updateProfileUrl, true, cookieLife);
            } else {
                setCookie('saml_request_path', redirectionUrl, true, cookieLife);
            }
        }
    } else {
        setCookie('saml_request_path', redirectionUrl, true, cookieLife);
    }
    setCookie('admp_ufln', decryptedDataJson.content.firstName + ' ' + decryptedDataJson.content.lastName, true, cookieLife);
    localStorage.setItem('admp_fn', decryptedDataJson.content.firstName);
    localStorage.setItem('admp_ln', decryptedDataJson.content.lastName);
    //redirect to dashboard page
    window.top.location.href = response.redirectUrl;
}

/**
 * bspUserProfileSubmitSuccess
 * @name bspUserProfileSubmitSuccess
 * @param {object} formPanel
 * @param {object} thankyouPanel
 * @param {object} [errorFragment] errorFragment, optional
 * @param {scope} globals
 */
function bspUserProfileSubmitSuccess(formPanel, thankyouPanel, errorFragment, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    const response = globals.event.payload.body;
    if (response) {
        const fullApiResponse = JSON.parse(response.metadata.fullApiResponse);
        if (fullApiResponse.isStatusSuccessful) {
            globals.functions.setProperty(formPanel, {visible: false});
            globals.functions.setProperty(errorFragment, {visible: false});
            globals.functions.setProperty(thankyouPanel, {visible: true});
            scrollToTarget('.PersonalInfoRoot', 0);
        } else {
            console.error("No Panel found");
        }
    } else {
        console.error("No response found in the payload.");
    }
}

/**
 * bspHealthcareProviderSubmitSuccess
 * @name bspHealthcareProviderSubmitSuccess
 * @param {object} section
 * @param {scope} globals
 */
function bspHealthcareProviderSubmitSuccess(section, globals) {
    $('.submit.button button').prop('disabled', true);
    elementChanged = false;
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    const successKey = "IsStatusSuccessful=";
    const successStart = jsonString.indexOf(successKey) + successKey.length;
    const successEnd = jsonString.indexOf("}", successStart);
    const isStatusSuccessful = jsonString.substring(successStart, successEnd);
    if (isStatusSuccessful === 'true') {
        baseApigeeSuccessAction(response);
        globals.functions.setProperty(section.healthcareProviderViewpanel, {'visible': true});
        globals.functions.setProperty(section.healthcareProviderEditpanel, {'visible': false});
    } else {
        eApiRegistrationFailure(globals);
    }
}

/**
 * Openenrollment - populate the form data during init
 * @name populateInitFormDateOpenEnrollment
 * @param {String} pidQueryName
 * @param {String} brandQueryName
 * @param {object} campaign4ResponseText
 * @param {object} campaign5ResponseId
 * @param {object} campaign5ResponseText
 * @param {scope} globals
 */
function populateInitFormDateOpenEnrollment(pidQueryName, brandQueryName, campaign4ResponseText,
        campaign5ResponseId, campaign5ResponseText, globals) {
        let pidText= baseUrlGetParam(pidQueryName); // get query param 'pid'
        let brandName= baseUrlGetParam(brandQueryName); // get query param 'brand'

        if(pidText!=null && pidText !== '') {// update patient id
            globals.functions.setProperty(campaign4ResponseText, { value: pidText });
        }
        if(!brandName) {
            return;
        }
        // case-insensitive map
          let brandIdMap = {
            'skyrizi': 1,
            'rinvoq': 2,
            'qulipta': 3, // covers QULIPTA/Qulipta due to lowercasing
            'ubrelvy': 4
          };

        let id = brandIdMap[brandName.toLowerCase()];
          if (id != null) {
            globals.functions.setProperty(campaign5ResponseId, { value: id });// set brand id
            globals.functions.setProperty(campaign5ResponseText, { value: brandName }); // set brand id
          }
}

/**
 * Okta Forgot Password Submit
 * @name baseOktaForgotPasswordSubmit
 * @param {string} username
 * @param {scope} globals
 */
function baseOktaForgotPasswordSubmit(username, globals) {
    showLoader(true);
    let apiUrl = '/bin/abbvie/cloudoktaforgotpassword';
    window.parent.AbbViePageInfo = window.parent.AbbViePageInfo || {};
    let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
    let payload = {
        'username': username
    };

    var proxyPayload = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        actionType: 'Apigee',
        originName: baseDetectDeviceType(),
        payload: JSON.stringify(payload),
        type: 'POST',
        version: window.abbviecloudforms.core.formProperties.version,
        formaction: 'ForgotPassword',
        pagePath: pagePath,
        data: JSON.stringify(payload)
    };
    $.ajax({
        type: 'POST',
        url: apiUrl,
        async: true,
        dataType: 'json',
        data: proxyPayload,
        success: function(response) {
                baseURLRedirection(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
        },
        error: function(error) {
            console.log(error.message);
            baseHandleErrorResponse(response, globals);

        }
    });
}

/**
 * oktaUpdateProfileErrorHandler
 * @name oktaUpdateProfileErrorHandler
 * @param {object} incorrectOldPasswordField
 * @param {object} passwordCannotBeCurrentPasswordField
 * @param {scope} globals
 */
function oktaUpdateProfileErrorHandler(incorrectOldPasswordField, passwordCannotBeCurrentPasswordField, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    try {
        const payload = JSON.parse(globals.event.payload.body);
        if (payload && payload.detail && payload.detail.includes('Old Password is not correct')) {
            globals.functions.setProperty(incorrectOldPasswordField, {visible: true});
            globals.functions.setProperty(passwordCannotBeCurrentPasswordField, {visible: false});
        } else if (payload && payload.detail && payload.detail.includes('Password cannot be your current password')) {
            globals.functions.setProperty(passwordCannotBeCurrentPasswordField, {visible: true});
            globals.functions.setProperty(incorrectOldPasswordField, {visible: false});
        } else {
            handleGenericError(globals);
        }
        admp_analytics_functions.onFormSubmitError();
    } catch (e) {
        handleGenericError(globals);
    }
}


/**
 * eapiCreonSignInSuccess
 * @name eapiCreonSignInSuccess
 * @param {object} apiResponse
 */

function eapiCreonSignInSuccess(apiResponse) {
    if (apiResponse && apiResponse.profileResponse &&
        apiResponse.profileResponse.patientId) {
        localStorage.setItem("patientId", apiResponse.profileResponse.patientId);
    } else {
        console.log("Invalid API response");
    }
}

/**
 * vraylarEnrollmentFragmentSuccessHandler
 * @name vraylarEnrollmentFragmentSuccessHandler
 * @param {string} insuranceCoverageType
 * @param {string} formType
 * @param {string} patientTypeText
 * @param {string} redirectUrl
 * @param {string} prospectRedirectUrl
 * @param {scope} globals
 */
function vraylarEnrollmentFragmentSuccessHandler(insuranceCoverageType, formType, patientTypeText, redirectUrl, prospectRedirectUrl, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    var response = globals.event.payload.body;
    console.log('guideResultObject: ' + JSON.stringify(response));
    const fullApiResponse = JSON.parse(response.metadata.fullApiResponse);

    if (formType === "Yes") {
        console.log("insuranceType:::::" + insuranceCoverageType);
        if (insuranceCoverageType === "1" && fullApiResponse && fullApiResponse.coPay[0]) {
            localStorage.setItem('admp_cci', JSON.stringify(fullApiResponse.coPay[0]));
            window.parent.location = redirectUrl + insuranceCoverageType + '&patientType=' + patientTypeText;
        }
        if (insuranceCoverageType === "2" || insuranceCoverageType === "3" || insuranceCoverageType === "4") {
            console.log("thankYouPageURL:::::::", redirectUrl + insuranceCoverageType);
            window.parent.location = redirectUrl + insuranceCoverageType + '&patientType=' + patientTypeText;
        }
    } else if (formType === "No") {
        window.parent.location = prospectRedirectUrl;
    }
}

/**
 * setCopayDetailsToVraylarSavingsCardThankYouPage
 * This function sets the copay details to the Vraylar Savings Card Thank You Page.
 * It can be used for Taytulla Thankyou page.
 * @name setCopayDetailsToVraylarSavingsCardThankYouPage
 * @param {object} section
 * @param {scope} globals
 */
function setCopayDetailsToVraylarSavingsCardThankYouPage(section) {
    if (localStorage.getItem('admp_cci')) {
        var copayDetails = JSON.parse(localStorage.getItem('admp_cci'));
        if (copayDetails) {
            var copaycardDetails = '<div class="vraylar-saving-card-info"><p>' + copayDetails.rxBIN + '</p><p>' + copayDetails.rxPCN + '</p><p>' + copayDetails.rxGroup + '</p><p>' + copayDetails.rxIdentifier + '</p></div>';
            $('.vraylarCopay').html(copaycardDetails);
        }
    }
}

/**
 * Botoxone Maxedge update profile
 * baseHDSMaxedgeSuccessHandler
 * @name baseHDSMaxedgeSuccessHandler
 * @param {scope} globals
 */
function baseHDSMaxedgeSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    localStorage.removeItem('MaxedgeCID');
    baseURLRedirection(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
}

/**
 * creonTrimKey
 * @name creonTrimKey
 * @param {string} value
 */

function creonTrimKey(value) {
    const cleanValue = String(value).trim().toLowerCase();
    if (cleanValue === "text message") {
      return "Text";
    }
    if (cleanValue === "email") {
      return "Email";
    }

    return cleanValue
      .split(/\s+/)
      .map(word => word.slice(0, 3))
      .join("_");
  }

/**
 * creonSetStorage
 * @name creonSetStorage
 * @param {string} key
 * @param {object} data
 * @param {string} parentToken
 */

   function creonSetStorage(key, data, parentToken = "") {
    if (Array.isArray(data)) {
      data.forEach(item => {
        let currentToken = parentToken;
        if (item && typeof item === "object") {
          if (item.serviceName) {
            currentToken = creonTrimKey(item.serviceName);
          } else if (item.channelName) {
            currentToken = creonTrimKey(item.channelName);
          }
        }
        creonSetStorage(key, item, currentToken);
      });
      return;
    }

    if (typeof data === "object" && data !== null) {
      Object.keys(data).forEach(childKey => {
        const value = data[childKey];
        if (childKey === "serviceName" || childKey === "channelName") {
          return;
        }

        let nextKey = parentToken
          ? `${key}_${parentToken}_${childKey}`
          : `${key}_${childKey}`;

        if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
          creonSetStorage(nextKey, value, parentToken);
        } else {
          localStorage.setItem(nextKey, value);
        }
      });
      return;
    }
    if(typeof(data) != 'object' || data === null ){
	    localStorage.setItem(key, data);
	}
  }

  /**
 * eapiCreonLoginthankYou
 * @name eapiCreonLoginthankYou
 * @param {object} [thankYouPanel]
 * @param {scope} globals
 */

  function eapiCreonLoginthankYou(thankYouPanel,globals){
    if (thankYouPanel) {
        globals.functions.setProperty(thankYouPanel, {visible: true});
    } else {
        baseURLRedirection(window.abbviecloudforms.core.formProperties.thankyoupageurl, globals);
    }
  }

 /**
 * eapiCreonLoginSuccess
 * @name eapiCreonLoginSuccess
 * @param {object} [thankYouPanel]
 * @param {scope} globals
 */

function eapiCreonLoginSuccess(thankYouPanel, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    if (globals.event.payload && globals.event.payload.body) {
        const jsonString = globals.event.payload.body.metadata.fullApiResponse;
        const jsonData = JSON.parse(jsonString);
        if (jsonData.profileResponse.status === 'true') {
          creonSetStorage("profileResponse", jsonData);
           eapiCreonLoginthankYou(thankYouPanel,globals);

        } else if(jsonData.profileResponse.status === 'false' && jsonData.profileResponse.failureResponse.some(ele => ele.code === "60012")){
                creonSetStorage("profileResponse", jsonData);
                eapiCreonLoginthankYou(thankYouPanel,globals);
       }else{
            eApiResponseFailure(globals);
       }
    }
}


/**
 * getCurrentUrl
 * @name getCurrentUrl
 * @return {string}
 */
function getCurrentUrl() {
    return window.location.href;
}

/**
 * saveCreonGetProductdata
 * @name saveCreonGetProductdata
 * @param {scope} globals
 */
function saveCreonGetProductdata(globals){
    $('.submit.button button').prop('disabled', false);
	setDraftIdToBlank(globals);
	const response = globals.event.payload.body;
	if(response.metadata && response.metadata.fullApiResponse){
		let data = JSON.parse(response.metadata.fullApiResponse);
		if(data.response.isStatusSuccessful === 'true'){
			localStorage.setItem('productData',JSON.stringify(data));
		}else{
			localStorage.setItem('productData_Error','No data Available');
		}
	} else {
        eApiRegistrationFailure(globals);
    }

}

/**
 * eapiCreonloginOTPSuccess
 * @name eapiCreonloginOTPSuccess
 * @param {string} localStorageKey
 * @param {object} cfCareForwardUrl
 * @param {object} creonCompleteURL
 * @param {scope} globals
 */

function eapiCreonloginOTPSuccess(localStorageKey, cfCareForwardUrl, creonCompleteURL, globals) {
 $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const jsonString = globals.event.payload.body.metadata.fullApiResponse;
    const jsonData = JSON.parse(jsonString);
    const programType = localStorage.getItem(localStorageKey);
    const accessToken = globals.event.payload.body.metadata.accessToken;
if (jsonData.profileResponse.status === 'true') {
        setCookie(
              "admp_login_token",
              accessToken,
              true,
              900
          );
        if (programType === "CFCareForward") {
            window.location.href = cfCareForwardUrl.$value;
        }
        else if (programType === "CREON Complete") {
            window.location.href = creonCompleteURL.$value;
        }
    } else {
        eApiResponseFailure(globals);
    }
}

/**
 * fabsSubmitSuccess
 * @name fabsSubmitSuccess
 * @param {object} [thankYouPanel]
 * @param {scope} globals
 */
function fabsSubmitSuccess(thankYouPanel, globals) {
    $('.fap-emailResultContainer button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body;
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    const successKey = "IsStatusSuccessful=";
    const successStart = jsonString.indexOf(successKey) + successKey.length;
    const successEnd = jsonString.indexOf("}", successStart);
    const isStatusSuccessful = jsonString.substring(successStart, successEnd);
    if (isStatusSuccessful === 'true') {
        baseApigeeSuccessAction(response);
        if (thankYouPanel) {
            $('.thankyouContainer').attr('data-cmp-visible','true');
            $('.emailContainer').attr('data-cmp-visible','false');
        } else {
            baseURLRedirection(window.abbviecloudforms.core.formProperties.thankyoupageurl, globals);
        }
    } else {
        eApiRegistrationFailure(globals);
    }
}


/**
 * @name creonOrderSubmit
 * @param {string} campaignKey
 * @param {object} hiddenCampaignsObj
 * @param {scope} globals
 */
function creonOrderSubmit(campaignKey, hiddenCampaignsObj, globals) {
if (navigator.cookieEnabled && baseGetCookieValue('admp_login_token') !== '') {
		validateToken(window.parent.AbbViePageInfo.apiEndPoints.validateLoginToken, { brandName: window.parent.AbbViePageInfo.brandConfig}).then(result => {
			if (result.valid) {
				const formData = baseCreateJsonArrayForEAPICampaigns(campaignKey, hiddenCampaignsObj, globals);
				var errors = globals.functions.validate();
				if (errors.length === 0 ||
					(errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
					$('.submit.button button').prop('disabled', true);
					fetchObservabilityAndSubmit(globals, formData);
				}
			} else {
				eApiResponseFailure(globals);
			}
		}).catch(error => {
			console.error("Error:", error);
		});
	} else {
		eApiResponseFailure(globals);
	}
}

/**
 * @name creonOrderSubmitSuccess
 * @param {string} localStorageKey
 * @param {object} cfCareForwardUrl
 * @param {object} creonCompleteURL
 * @param {scope} globals
 */
function creonOrderSubmitSuccess(localStorageKey, cfCareForwardUrl, creonCompleteURL, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    if (globals.event.payload && globals.event.payload.body) {
        const response = globals.event.payload.body;
        const jsonString = response.metadata.fullApiResponse;
        const jsonData = JSON.parse(jsonString);
        const programType = localStorage.getItem(localStorageKey);
        if (jsonData.response.isStatusSuccessful === 'true' || jsonData.response.isStatusSuccessful === 'false') {
            creonSetStorage("orderResponse", jsonData);
            if (programType === "CFCareForward") {
                window.location.href = cfCareForwardUrl.$value;
            }
            else if (programType === "CREON Complete") {
                window.location.href = creonCompleteURL.$value;
            }
        } else {
            eApiResponseFailure(globals);
        }
}
}

/**
 * eApiResponseFailure
 * @name eApiResponseFailure
 * @param {scope} globals
 */
function eApiResponseFailure(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    const response = globals.event.payload.body.metadata.fullApiResponse;
    let payload = JSON.parse(response);
    let errorList = [];
    if(payload.isStatusSuccessful === 'false'){
        errorList = payload.errorResponseMessageList;
        errorList = parseErrorList(payload.errorResponseMessageList);
    }else if(payload.profileResponse && payload.profileResponse.status === 'false'){
        errorList = payload.profileResponse.failureResponse;
        errorList = parseErrorList(payload.profileResponse.failureResponse);
    }else if(payload.response && payload.response.isStatusSuccessful === 'false'){
        errorList = payload.response.failureResponse;
        errorList = parseErrorList(payload.response.failureResponse);
    }
    if(errorList.length > 0 ){
        baseHandleErrorResponse(errorList, globals);
        admp_analytics_functions.onFormSubmitError(response);
    }
}


function parseErrorList(errorArrayObj){
	let errorsArray = [];
	let errObj ={};
	errorArrayObj.forEach((errorCode, index) => {
		let errCode = errorCode.code || errorCode.errorCode;
		let errMsg = errorCode.message || errorCode.errorMessage;
		errObj[errCode] = errMsg;
		errorsArray.push(errObj);
	});
	return errorsArray;
}

/**
 * validateToken
 * @name validateToken
 */
async function validateToken(url = "", data = {}) {
	try {
		const response = await fetch(url, {
			method: "POST", // Specify the method
			headers: {
				"Content-Type": "application/json", // Tell server you're sending JSON
			},
			body: JSON.stringify(data), // Convert JS object to JSON string
		});

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const tokenResult = await response.json(); // Parse the response as JSON
		return tokenResult;
	} catch (error) {
		console.error("Error:", error);
	}
}

/**
 * @name creonOrderSubmitSuccess
 * @param {string} localStorageKey
 */
function creonClearLocalStorage(localStorageKey) {
    Object.keys(localStorage)
        .filter(key => key.startsWith(localStorageKey))
        .forEach(key => localStorage.removeItem(key));
}

/**
 * botoxOneRegistrationSubmit
 * @name botoxOneRegistrationSubmit
 * @param {scope} globals
 */
function botoxOneRegistrationSubmit(globals) {
    var formData = globals.functions.exportData();
    if (formData.HcpRegistrationRequest.practice.maxedgeUser === "out") {
        delete formData.HcpRegistrationRequest.practice.programs;
    }
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 &&
         errors[0].fieldName &&
         errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}
/**
 * Fetches observability data, sets cookie, enriches formData and submits
 * @name fetchObservabilityAndSubmit
 * @param {scope} globals
 * @param {object} formData
 * @return {void}
 */
function fetchObservabilityAndSubmit(globals, formData) {
    var formProperties = window.abbviecloudforms &&
        window.abbviecloudforms.core &&
        window.abbviecloudforms.core.formProperties;

    var formPath = formProperties ? formProperties["fd:path"] : null;

    if (!formPath) {
        console.warn("formPath not available, submitting without observability data");
        globals.functions.submitForm(formData, true, 'application/json');
        return;
    }

    if (typeof $ === "undefined") {
        console.warn("jQuery not available, submitting without observability data");
        globals.functions.submitForm(formData, true, 'application/json');
        return;
    }

    $.ajax({
        url: '/abbviecloud/bin/abbvie/observability',
        method: 'GET',
        contentType: 'application/json',
        data: { formPath: formPath },
        success: function (result) {
            var data = (result && result.data) ? result.data : {};

            formData.businessProcess  = (data.businessProcess  || '').trim();
            formData.transactionname  = (data.transactionname  || '').trim();
            formData.responsetransactionname = (data.responsetransactionname || '').trim();
            formData.overridecustommetadata  = data.overridecustommetadata === true;
            formData.corelationname   = (data.corelationname   || '').trim();
            formData.correlationstart = (data.correlationstart || '').trim();

            var correlationName  = (data.corelationname  || '').trim();
            var correlationStart = (data.correlationstart || '').trim();
            if (correlationName && correlationStart) {
                setCookie(
                    correlationName.trim().toLowerCase().replace(/ /g, "-"),
                    generateUUID(),
                    false,
                    31536000
                );
            }

            console.log("Final Payload:", formData);
            globals.functions.submitForm(formData, true, 'application/json');
        },
        error: function (jqXHR) {
            console.error(
                "Observability GET failed [" + jqXHR.status + "], submitting without observability data"
            );
            globals.functions.submitForm(formData, true, 'application/json');
        }
    });
}

 /**
  * @name baseValidateNpi
  * @param {string} npiTextboxValue
  * @returns {boolean}
  */
function baseValidateNpi(npiTextboxValue) {
     var npi = /^\d{10}$/;
     return npi.test(String(npiTextboxValue || '').trim());
}

 /**
  * @name getTodaysDate
  * Returns today's date in MM/DD/YYYY format.
  *
  * @param {scope} globals
  * @returns {string}
  */
function getTodaysDate(globals) {
     var today = new Date();
     var dd = today.getDate();
     var mm = today.getMonth() + 1;
     var yyyy = today.getFullYear();

     if (dd < 10) dd = '0' + dd;
     if (mm < 10) mm = '0' + mm;

     return mm + '/' + dd + '/' + yyyy;
}

/**
 * @name toggleSubmitOnSignature
 * Enable/disable submit button based on signature value on every keystroke
 *
 * @param {object} signature
 * @param {object} submit
 * @param {scope} globals
 */
function toggleSubmitOnSignature(signature, submit, globals) {
  if (!globals || !globals.functions || !globals.functions.setProperty) return;
  if (window._sigSubmitBindDone) return;
  window._sigSubmitBindDone = true;
  function updateFromDom() {
    var sigInput = document.querySelector('input[name="signature"].cmp-adaptiveform-textinput__widget')
      || document.querySelector('input[name="signature"]');
    var v = sigInput && sigInput.value != null ? String(sigInput.value).trim() : '';
    var hasValue = v.length > 0;
    globals.functions.setProperty(submit, {
      enabled: hasValue,
      disabled: !hasValue
    });
  }
  updateFromDom();
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t && t.tagName === 'INPUT' && t.name === 'signature') {
      updateFromDom();
    }
  });
  document.addEventListener('keyup', function (e) {
    var t = e.target;
    if (t && t.tagName === 'INPUT' && t.name === 'signature') {
      updateFromDom();
    }
  });
}

/**
 * Show/hide the camera capture button based on the device type.
 * Hides the button on desktop and displays it on mobile/tablet.
 */
function toggleCameraCaptureButton () {
    const deviceType = baseDetectDeviceType();
    const $cameraButton = $('.abbv-camera-capture-btn');

    if (!$cameraButton.length) {
        return;
    }

    if (deviceType === 'originNameWeb') {
        $cameraButton.hide();
    } else {
        $cameraButton.show();
    }
}

 /**
 * @name baseHandleEditInfo
 * Handles Edit Information button click.
 * Shows editable panel and copies values from registration panel.
 *
 * @param {object} hcpRegistrationPanel - Source panel
 * @param {object} hcpConformPanel - Confirmation panel
 * @param {scope} globals
 * @returns {boolean}
 */
function baseHandleEditInfo(hcpRegistrationPanel, hcpConformPanel, globals) {
    triggerAnalyticsEventOnButton(globals.event.target);
    const mailingAddressPanel = hcpRegistrationPanel?.mailingAddressPanel || hcpRegistrationPanel;
    if (typeof scrollTopOnFormInit === 'function') {
        scrollTopOnFormInit();
    } else if (typeof window !== 'undefined' && window.scrollTo) {
        window.scrollTo(0, 0);
    }
    if (!globals || !globals.functions || typeof globals.functions.setProperty !== 'function') {
        return false;
    }
    var editPanel = hcpConformPanel && hcpConformPanel.editablePanel;
    function safeSet(node, props) {
        if (!node) return;
        try {
            globals.functions.setProperty(node, props);
        } catch (e) {
        }
    }
    safeSet(hcpConformPanel && hcpConformPanel.reviewPanel, { visible: false });
    safeSet(editPanel, { visible: true });
    safeSet(hcpConformPanel && hcpConformPanel.consentPanel, { visible: false });
    safeSet(hcpConformPanel && hcpConformPanel.googleCaptchaPanel, { visible: false });
    safeSet(hcpConformPanel && hcpConformPanel.submitPanel, { visible: false });

    function getVal(field) {
        if (!field) return '';
        if (field.$value !== undefined && field.$value !== null) return String(field.$value);
        if (field.value !== undefined && field.value !== null) return String(field.value);
        return '';
    }
    function setVal(field, value) {
        if (!field) return;
        safeSet(field, { value: value });
    }
    setVal(editPanel && editPanel.editPracticeName, getVal(mailingAddressPanel && mailingAddressPanel.practiceName));
    setVal(editPanel && editPanel.editPrefix, getVal(mailingAddressPanel && mailingAddressPanel.prefix));
    setVal(editPanel && editPanel.editFirstName, getVal(mailingAddressPanel && mailingAddressPanel.firstName));
    setVal(editPanel && editPanel.editLastName, getVal(mailingAddressPanel && mailingAddressPanel.lastName));
    setVal(editPanel && editPanel.editSuffix, getVal(mailingAddressPanel && mailingAddressPanel.suffix));
    setVal(editPanel && editPanel.editProfessionalDesignation, getVal(mailingAddressPanel && mailingAddressPanel.professionalDesignation));
    setVal(editPanel && editPanel.editEmailAddress, getVal(mailingAddressPanel && mailingAddressPanel.emailAddress));
    setVal(editPanel && editPanel.editStreetAddress1, getVal(mailingAddressPanel && mailingAddressPanel.streetAddress1));
    setVal(editPanel && editPanel.editStreetAddress2, getVal(mailingAddressPanel && mailingAddressPanel.streetAddress2));
    setVal(editPanel && editPanel.editCity, getVal(mailingAddressPanel && mailingAddressPanel.city));
    setVal(editPanel && editPanel.editState, getVal(mailingAddressPanel && mailingAddressPanel.state));
    setVal(editPanel && editPanel.editZipCode, getVal(mailingAddressPanel && mailingAddressPanel.zipCode));
    return true;
}


 /**
  * @name validateHcpEmailAndMatchback
  * Triggered on Email field Blur/Change.
  * 1) Validate email format using baseValidateEmail(email, msg, globals)
  * 2) If valid, call S3 matchback async to check "already exists"
  * @param {object} emailAddress
  * @param {object} HcpLookupPanel
  * @param {object} hcpRegistrationPanel
  * @param {object} emailAlreadyExistsError
  * @param {object} hiddenInvalidEmailAddressField
  * @param {scope} globals
  * @returns {boolean} always true (async will update validity)
  */
function validateHcpEmailAndMatchback(emailAddress, HcpLookupPanel, hcpRegistrationPanel, emailAlreadyExistsError, hiddenInvalidEmailAddressField, globals) {
    var emailVal = (emailAddress && emailAddress.$value) ? String(emailAddress.$value).trim() : '';
    if (!emailVal) {
        globals.functions.setProperty(emailAddress, { valid: true });
        return emailVal;
    }
    var invalidMsg = (hiddenInvalidEmailAddressField && hiddenInvalidEmailAddressField.$value)
        ? hiddenInvalidEmailAddressField.$value
        : 'Please enter a valid email address.';
    if (!baseValidateEmail(emailAddress, invalidMsg, globals)) {
        globals.functions.setProperty(emailAddress, { valid: false, errorMessage: invalidMsg });
        return emailVal;
    }
    baseNPIMatchBackS3Async(emailVal, true, HcpLookupPanel, hcpRegistrationPanel, null, emailAddress, emailAlreadyExistsError, globals);
    return emailVal;
}

 /**
  * @name baseNPIMatchBackS3Async
  * S3 Matchback (Cloud):
  * - For email: if exists => mark invalid with message
  * - For NPI: if not exists => call Apigee lookup to prefill
  * - If fetch fails: fallback to Apigee for NPI path
  *
  * @param {string} npi_id
  * @param {boolean} isEmailValidation
  * @param {object} HcpLookupPanel
  * @param {object} hcpRegistrationPanel
  * @param {object|null} hiddenUrlPanel
  * @param {object} emailAddress
  * @param {object} emailAlreadyExistsError
  * @param {scope} globals
  * @returns {Promise<void>}
  */
function baseNPIMatchBackS3Async(npi_id, isEmailValidation, HcpLookupPanel, hcpRegistrationPanel, hiddenUrlPanel, emailAddress, emailAlreadyExistsError, globals) {
     var s3_api_url = '/abbviecloud/bin/abbvie/v1/npilookupapiproxy';
     var invalidMsg = (hiddenUrlPanel && hiddenUrlPanel.invalidMsgError && (hiddenUrlPanel.invalidMsgError.$value || hiddenUrlPanel.invalidMsgError.value))
             ? (hiddenUrlPanel.invalidMsgError.$value || hiddenUrlPanel.invalidMsgError.value) : '';
     var invalidApi = (hiddenUrlPanel && hiddenUrlPanel.invaliApiError && (hiddenUrlPanel.invaliApiError.$value || hiddenUrlPanel.invaliApiError.value))
             ? (hiddenUrlPanel.invaliApiError.$value || hiddenUrlPanel.invaliApiError.value) : '';
     var errApiMsg = (hiddenUrlPanel && hiddenUrlPanel.apiErrorOccured && (hiddenUrlPanel.apiErrorOccured.$value || hiddenUrlPanel.apiErrorOccured.value))
             ? (hiddenUrlPanel.apiErrorOccured.$value || hiddenUrlPanel.apiErrorOccured.value) : '';
     var proxyPayload = {
         brandName: window.abbviecloudforms.core.formProperties.brandName,
         actionType: 'ApigeeHDS',
         originName: baseDetectDeviceType(),
         requestType: 'POST',
         version: 'V1',
         npiId: npi_id,
         formAction: 'MatchBack'
     };
    const npiTextbox = HcpLookupPanel.screen1 ? HcpLookupPanel.screen1.HcpLookupPanel.npiTextbox  : HcpLookupPanel.npiTextbox;
    if (!isEmailValidation && typeof showLoader === 'function') {
            showLoader(true);
        }
     var formBody = new URLSearchParams(proxyPayload);
     return fetch(s3_api_url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
       body: formBody
     })
     .then(function (response) {
         if (!response.ok) {
             throw new Error('HTTP ' + response.status + ' ' + response.statusText);
         }
         return response.json();
     })
     .then(function (data) {
        if (!isEmailValidation && typeof showLoader === 'function') {
            showLoader(false);
         }
         if (data && data.IsStatusSuccessful) {
             if (!isEmailValidation) {
                 if (hiddenUrlPanel && hiddenUrlPanel.npiAlreadyRegisteredUrl) {
                     var url = hiddenUrlPanel.npiAlreadyRegisteredUrl.$value || hiddenUrlPanel.npiAlreadyRegisteredUrl.value;
                     if (url) window.location.href = url;
                 }
             } else {
                 var existsMsg = (emailAlreadyExistsError && (emailAlreadyExistsError.$value || emailAlreadyExistsError.value))
                     ? (emailAlreadyExistsError.$value || emailAlreadyExistsError.value)
                     : 'This email address is already registered.';

                 globals.functions.setProperty(emailAddress, {
                     valid: false,
                     errorMessage: existsMsg
                 });
             }
             return;
         }
         if (!isEmailValidation) {
             baseGetHCPByNPIGastroNPI(npiTextbox, HcpLookupPanel, hcpRegistrationPanel, invalidMsg, errApiMsg, invalidApi, null,globals);
         } else {
             globals.functions.setProperty(emailAddress, { valid: true, errorMessage: '' });
         }
     })
     .catch(function (e) {
         if (!isEmailValidation && typeof showLoader === 'function') {
            showLoader(false);
         }
         if (!isEmailValidation) {
             baseGetHCPByNPIGastroNPI(npiTextbox, HcpLookupPanel, hcpRegistrationPanel, invalidMsg, errApiMsg, invalidApi, null,globals);
         } else {
             globals.functions.setProperty(emailAddress, {
                 valid: false,
                 errorMessage: errApiMsg
             });
         }
     });
 }

 /**
  * @name baseGetHCPByNPIGastroNPI
  * Calls /abbviecloud/bin/abbvie/apiproxy and prefills Gastro registration panel.
  *
  * @param {object} npiTextbox
  * @param {object} lookUpPanel
  * @param {object} repPanel
  * @param {object|null} metadataPanel
  * @param {scope} globals
  * @returns {boolean}
  */
function baseGetHCPByNPIGastroNPI(npiTextbox, lookUpPanel, repPanel, invalidMsg, errApiMsg, invalidApi, metadataPanel, globals) {
     var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
     var npiVal = '';
     if (npiTextbox && npiTextbox.$value) npiVal = String(npiTextbox.$value).trim();
     else if (npiTextbox && npiTextbox.value) npiVal = String(npiTextbox.value).trim();
     if (!npiVal) {
         globals.functions.setProperty(npiTextbox, {
             valid: false,
             errorMessage: invalidMsg
         });
         return false;
     }
     var proxyApigeeData = {
         brandName: window.abbviecloudforms.core.formProperties.brandName,
         payload: JSON.stringify({ npi_id: npiVal }),
         actionType: 'ApigeeHDS',
         originName: baseDetectDeviceType(),
         formAction: 'EnterpriseHCPLookupByNPI',
         version: 'V1',
         formRequest: 'Yes'
     };
     if (typeof showLoader === 'function') showLoader(true);
     function onFailure(error) {
         if (typeof showLoader === 'function') showLoader(false);
         globals.functions.setProperty(npiTextbox, {
             valid: false,
             errorMessage: errApiMsg
         });
     }
     function onSuccess(data) {
         if (typeof showLoader === 'function') showLoader(false);
         if (data && data.status === 'SUCCESS' && data.content && data.content.length) {
             baseGastroPrefillHCPDataFromNPI(data.content, repPanel, lookUpPanel, globals);
         } else {
             globals.functions.setProperty(npiTextbox, {
                 valid: false,
                 errorMessage: invalidApi
             });
         }
     }
     baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, onSuccess, onFailure);
     return true;
}

 /**
  * @name baseGastroPrefillHCPDataFromNPI
  * Prefill Gastro panel from NPI response
  *
  * @param {Array} HCPDataFromNPI
  * @param {object} hcpRegistrationPanel
  * @param {object} HcpLookupPanel
  * @param {scope} globals
  * @returns {boolean}
  */
function baseGastroPrefillHCPDataFromNPI( HCPDataFromNPI, hcpRegistrationPanel, HcpLookupPanel, globals) {
    if (!HCPDataFromNPI?.length) return false;
    const npiData = HCPDataFromNPI[0] || {};
    const mailingAddressPanel = hcpRegistrationPanel?.mailingAddressPanel || hcpRegistrationPanel;
    const wizard = HcpLookupPanel.screen1 ? HcpLookupPanel : '';
    var HcpLookupPanel = HcpLookupPanel.screen1 ? HcpLookupPanel.screen1.HcpLookupPanel : HcpLookupPanel;

    const {
        degree,
        first_name = '',
        last_name = '',
        practiceName = '',
        email = '',
        address_line_1 = '',
        address_line_2 = '',
        city = '',
        state = '',
        zip = ''
    } = npiData;

    const setValue = (field, value = '') => {
        if (!field) return;
        if(value) {
            globals.functions.setProperty(field, { value });
        }
    };

    const npiValue = HcpLookupPanel?.npiTextbox?.$value || HcpLookupPanel?.npiTextbox?.value || '';
    const invalidDegrees = new Set(['null', 'undefined', 'unknown']);
    const normalizedDegree = String(degree || '').toLowerCase();
    const professionalDesignation = !invalidDegrees.has(normalizedDegree) ? degree || '' : '';

    if (mailingAddressPanel) {
        const fieldMappings = [
            [mailingAddressPanel.npiId, npiValue],
            [mailingAddressPanel.firstName, first_name],
            [mailingAddressPanel.lastName, last_name],
            [mailingAddressPanel.professionalDesignation, professionalDesignation],
            [mailingAddressPanel.practiceName, practiceName],
            [mailingAddressPanel.emailAddress, email],
            [mailingAddressPanel.streetAddress1, address_line_1],
            [mailingAddressPanel.streetAddress2, address_line_2],
            [mailingAddressPanel.city, city],
            [mailingAddressPanel.state, state],
            [mailingAddressPanel.zipCode, zip]
        ];
        fieldMappings.forEach(([field, value]) => setValue(field, value));
    }
    globals.functions.setProperty(hcpRegistrationPanel, { visible: true });
    globals.functions.setProperty(HcpLookupPanel, { visible: false });
     if(wizard) {
        	globals.functions.setFocus(wizard, 'nextItem');
     }
    return true;
}

 /**
  * @name nextButton1Click
  * Next button click:
  * - validate lookup panel
  * - S3 matchback for NPI
  * - if not found => Apigee prefill
  *
  * @param {object} HcpLookupPanel
  * @param {object} npiTextbox
  * @param {object} hcpRegistrationPanel
  * @param {object} hiddenUrlPanel
  * @param {object} emailAddress
  * @param {scope} globals
  * @returns {boolean}
  */
function nextButton1Click(HcpLookupPanel, npiTextbox, hcpRegistrationPanel, hiddenUrlPanel, emailAddress, globals) {
    triggerAnalyticsEventOnButton(globals.event.target);
    let lookupPanel  = HcpLookupPanel.screen1 ? HcpLookupPanel.screen1.HcpLookupPanel : HcpLookupPanel ;

    var npiVal = '';
    if (npiTextbox) {
        var rawValue = (npiTextbox.$value !== undefined && npiTextbox.$value !== null)
            ? npiTextbox.$value
            : npiTextbox.value;
        npiVal = String(rawValue !== undefined && rawValue !== null ? rawValue : '').trim();

        if (globals.functions.setProperty) {
            globals.functions.setProperty(npiTextbox, { value: npiVal });
        }
    }

    var npiErrors = globals.functions.validate(npiTextbox);
    if (npiErrors && npiErrors.length > 0) {
        if (globals.functions.setFocus) {
            globals.functions.setFocus(npiTextbox);
        } else if (globals.functions.setProperty) {
            globals.functions.setProperty(npiTextbox, { focused: true });
        }
        return false;
    }

    var errors = globals.functions.validate(lookupPanel);
    if (errors && errors.length > 0) {
        return false;
    }

    baseNPIMatchBackS3Async(npiVal, false, HcpLookupPanel, hcpRegistrationPanel, hiddenUrlPanel, emailAddress, null, globals);
    return true;
}

/**
* @name screen3Navigation
* @description Cloud Visual Editor function for screen 3 navigation
* - Validates the registration panel
* - Checks file upload gating (abbvFileUpload.canProceed())
* - If OK, transitions to confirmation panel + builds review values
*
* @param {object} hcpRegistrationPanel
* @param {object} imageUploadPanel
* @param {scope} globals
* @returns {boolean}
*/
function screen3Navigation(hcpRegistrationPanel, imageUploadPanel, globals) {
   var wizard = hcpRegistrationPanel.screen2 ? hcpRegistrationPanel : '';
    var hcpRegistrationPanel = hcpRegistrationPanel.screen2 ? hcpRegistrationPanel.screen2.hcpRegistrationPanel : hcpRegistrationPanel;
    var errors = globals.functions.validate(hcpRegistrationPanel);
    triggerAnalyticsEventOnButton(globals.event.target);
    let isValidationSuccess = validateErrors(errors);
    if(isValidationSuccess == false) {
        let elementById = getElementById(errors[0].fieldName);
        if (elementById.$id) {
            globals.functions.setFocus(elementById);
        } else {
            elementById.$id = elementById.id;
            globals.functions.setFocus(elementById);
        }
         return false;
    }
    globals.functions.setProperty(hcpRegistrationPanel, { visible: false });
    globals.functions.setProperty(imageUploadPanel, { visible: true });
   if(wizard) {
    globals.functions.setFocus(wizard, 'nextItem');
    setTimeout(function () {
        if($('.imageUploadPanel').length){
            scrollToTarget('.imageUploadPanel', 0);
        }
    }, 50);
   }
    return true;
}

/**
* @name screen4Navigation
* @description Cloud Visual Editor function for screen 4 navigation
* - Validates the registration panel
* - Checks file upload gating (abbvFileUpload.canProceed())
*
* @param {object} hcpRegistrationPanel
* @param {object} imageUploadPanel
* @param {object} hcpConformPanel
* @param {scope} globals
* @returns {boolean}
*/
function screen4Navigation(hcpRegistrationPanel, imageUploadPanel, hcpConformPanel, globals) {
     var errors = globals.functions.validate(imageUploadPanel);
     triggerAnalyticsEventOnButton(globals.event.target);
     let isValidationSuccess = validateErrors(errors);
     if(isValidationSuccess == false) {
          scrollToTarget('.imageUploadPanel', 200);
          return false;
      }
     if (typeof abbvFileUpload !== 'undefined' &&
         abbvFileUpload &&
         typeof abbvFileUpload.canProceed === 'function' && !abbvFileUpload.canProceed()) {
            scrollToTarget('.imageUploadPanel', 200);
            return false;
     }
     globals.functions.setProperty(imageUploadPanel, { visible: false });
     baseHandleNextButtonTwo(hcpRegistrationPanel, hcpConformPanel, globals);
     return true;
 }

 function validateErrors(errors) {
     if (errors && errors.length > 0) {
         var filtered = [];
         for (var i = 0; i < errors.length; i++) {
             if (errors[i] && errors[i].fieldName && String(errors[i].fieldName).indexOf('file-upload-') === 0) {
                 continue;
             }
             filtered.push(errors[i]);
         }
         if (filtered.length > 0) {
             return false;
         }
     }
     return true;
 }


/**
* @name nextButton2Click
* @description Cloud Visual Editor function for Next Button 2
* - Validates the registration panel
* - Checks file upload gating (abbvFileUpload.canProceed())
* - If OK, transitions to confirmation panel + builds review values
*
* @param {object} hcpRegistrationPanel
* @param {object} hcpConformPanel
* @param {scope} globals
* @returns {boolean}
*/
function nextButton2Click(hcpRegistrationPanel, hcpConformPanel, globals) {
     var errors = globals.functions.validate(hcpRegistrationPanel);
     triggerAnalyticsEventOnButton(globals.event.target);
     if (errors && errors.length > 0) {
         var filtered = [];
         for (var i = 0; i < errors.length; i++) {
             if (errors[i] && errors[i].fieldName && String(errors[i].fieldName).indexOf('file-upload-') === 0) {
                 continue;
             }
             filtered.push(errors[i]);
         }
         if (filtered.length > 0) {
             return false;
         }
     }
     if (typeof abbvFileUpload !== 'undefined' &&
         abbvFileUpload &&
         typeof abbvFileUpload.canProceed === 'function') {
         if (!abbvFileUpload.canProceed()) {
             return false;
         }
     }
     baseHandleNextButtonTwo(hcpRegistrationPanel, hcpConformPanel, globals);
     return true;
 }

/**
  * @name baseabbvFileUpload
  *
  * @returns {boolean}
  */
function baseabbvFileUpload(){
    abbvFileUpload.canProceed();
}

/**
  * @name baseHandleNextButtonTwo
  * @description Handles Next button transition from Registration panel -> Confirmation panel
  *
  * @param {object} hcpRegistrationPanel
  * @param {object} hcpConformPanel
  * @param {scope} globals
  * @returns {boolean}
*/
function baseHandleNextButtonTwo(hcpRegistrationPanel, hcpConformPanel, globals) {
     if (typeof scrollTopOnFormInit === 'function') {
         scrollTopOnFormInit();
     } else if (window && window.scrollTo) {
         window.scrollTo(0, 0);
     }
     var brochureType = hcpRegistrationPanel.brochurePersonalization && (hcpRegistrationPanel.brochurePersonalization.$value || hcpRegistrationPanel.brochurePersonalization.value || '');
     const mailingAddressPanel = hcpRegistrationPanel?.mailingAddressPanel || hcpRegistrationPanel;
     globals.functions.setProperty(hcpRegistrationPanel, { visible: false });
     globals.functions.setProperty(hcpConformPanel, { visible: true });
     if (hcpConformPanel.reviewPanel) {
         globals.functions.setProperty(hcpConformPanel.reviewPanel, { visible: true });
     }
     if (hcpConformPanel.editablePanel) {
         globals.functions.setProperty(hcpConformPanel.editablePanel, { visible: false });
     }
     function readVal(field) {
         if (!field) return '';
         if (field.$value !== undefined && field.$value !== null) return String(field.$value);
         if (field.value !== undefined && field.value !== null) return String(field.value);
         return '';
     }
     if(mailingAddressPanel ) {
         var prefix = mailingAddressPanel.prefix && readVal(mailingAddressPanel.prefix).trim();
         var first = readVal(mailingAddressPanel.firstName).trim();
         var last  = readVal(mailingAddressPanel.lastName).trim();
         var suffix = readVal(mailingAddressPanel.suffix).trim();
         var pd = readVal(mailingAddressPanel.professionalDesignation).trim();
         var practiceName = mailingAddressPanel.practiceName && readVal(mailingAddressPanel.practiceName).trim() || '';
         var headline = '';
         if(brochureType && brochureType === 'medicalPractice') {
            headline = practiceName ? practiceName : '';
         } else {
             headline = prefix ? prefix + ' ' + (first + ' ' + last).trim() : (first + ' ' + last).trim();
             if (suffix && suffix != ' ') headline += (', ' + suffix);
             if (pd) headline += (', ' + pd);
         }
         if (hcpConformPanel.reviewPanel && hcpConformPanel.reviewPanel.headlineValuesText) {
             globals.functions.setProperty(hcpConformPanel.reviewPanel.headlineValuesText, { value: headline });
         }
         var email = readVal(mailingAddressPanel.emailAddress).trim();
         var a1 = readVal(mailingAddressPanel.streetAddress1).trim();
         var a2 = readVal(mailingAddressPanel.streetAddress2).trim();
         var city = readVal(mailingAddressPanel.city).trim();
         var state = readVal(mailingAddressPanel.state).trim();
         var zip = readVal(mailingAddressPanel.zipCode).trim();
         if (hcpConformPanel.reviewPanel) {
             if (hcpConformPanel.reviewPanel.reviewEmailAddress) {
                 $('.reviewEmailAddress .reviewEmailAddress').text(email);
             }
             if (hcpConformPanel.reviewPanel.reviewStreetAddress) {
                 $('.reviewStreetAddress .reviewStreetAddress').text(a1);
             }
             if (hcpConformPanel.reviewPanel.reviewStreetAddress2) {
                 $('.reviewStreetAddress2 .reviewStreetAddress2').text(a2);
             }
             if (hcpConformPanel.reviewPanel.reviewCity) {
                 $('.reviewCity .reviewCity').text(city);
             }
             if (hcpConformPanel.reviewPanel.reviewState) {
                 $('.reviewState .reviewState').text(state);
             }
             if (hcpConformPanel.reviewPanel.reviewZipcode) {
                 $('.reviewZipcode .reviewZipcode').text(zip);
             }
          }

         if($('.optinPanel .practiceInfoOptinCheckbox').length && practiceName) {
            var practiceOptInText =  $('.practiceInfoOptinCheckbox input').next('label').text().replaceAll('[practiceName]', practiceName);
            $('.practiceInfoOptinCheckbox input').next('label').text(practiceOptInText);
         }
     }
     return true;
}

/**
 * @name baseHandleSaveChanges
 * Handles saving changes from the editable user information panel.
 * Validates the editable fields, updates registration data, and shows the updated review panel.
 *
 * @param {Object} hcpRegistrationPanel - Reference to the user registration panel
 * @param {Object} hcpConformPanel - Reference to the user confirmation panel
 * @param {scope} globals
 * @returns {boolean}
 */
function baseHandleSaveChanges(hcpRegistrationPanel, hcpConformPanel, globals) {
    var errors = globals.functions.validate(hcpConformPanel.editablePanel);
    var brochureType = hcpRegistrationPanel.brochurePersonalization && (hcpRegistrationPanel.brochurePersonalization.$value || hcpRegistrationPanel.brochurePersonalization.value || '');
    triggerAnalyticsEventOnButton(globals.event.target);
    if (errors && errors.length > 0) {
        return false;
    }
    if (typeof scrollTopOnFormInit === 'function') {
        scrollTopOnFormInit();
    } else if (typeof window !== 'undefined' && window && window.scrollTo) {
        window.scrollTo(0, 0);
    }

     const mailingAddressPanel = hcpRegistrationPanel?.mailingAddressPanel || hcpRegistrationPanel;

    var editPanel = hcpConformPanel.editablePanel;
    var revPanel = hcpConformPanel.reviewPanel;
    function getVal(field) {
        if (!field) return '';
        if (field.$value !== undefined && field.$value !== null) return String(field.$value);
        if (field.value !== undefined && field.value !== null) return String(field.value);
        return '';
    }
    function setVal(field, value) {
        if (field) globals.functions.setProperty(field, { value: value });
    }
     mailingAddressPanel.practiceName && editPanel.editPracticeName && setVal(mailingAddressPanel.practiceName, getVal(editPanel.editPracticeName));
     mailingAddressPanel.prefix && editPanel.editPrefix && setVal(mailingAddressPanel.prefix, getVal(editPanel.editPrefix));
    setVal(mailingAddressPanel.firstName, getVal(editPanel.editFirstName));
    setVal(mailingAddressPanel.lastName, getVal(editPanel.editLastName));
    setVal(mailingAddressPanel.suffix, getVal(editPanel.editSuffix));
    setVal(mailingAddressPanel.professionalDesignation, getVal(editPanel.editProfessionalDesignation));
    setVal(mailingAddressPanel.emailAddress, getVal(editPanel.editEmailAddress));
    setVal(mailingAddressPanel.streetAddress1, getVal(editPanel.editStreetAddress1));
    setVal(mailingAddressPanel.streetAddress2, getVal(editPanel.editStreetAddress2));
    setVal(mailingAddressPanel.city, getVal(editPanel.editCity));
    setVal(mailingAddressPanel.state, getVal(editPanel.editState));
    setVal(mailingAddressPanel.zipCode, getVal(editPanel.editZipCode));
    if (revPanel && revPanel.reviewEmailAddress) {
        var emailValue = getVal(editPanel.editEmailAddress);
        $('.reviewEmailAddress .reviewEmailAddress').text(emailValue);
    }
    if (revPanel && revPanel.reviewStreetAddress) {
        var street1Value = getVal(editPanel.editStreetAddress1);
        $('.reviewStreetAddress .reviewStreetAddress').text(street1Value);
    }
    if (revPanel && revPanel.reviewStreetAddress2) {
        var street2Value = getVal(editPanel.editStreetAddress2);
        $('.reviewStreetAddress2 .reviewStreetAddress2').text(street2Value);
    }
    if (revPanel && revPanel.reviewCity) {
        var cityValue = getVal(editPanel.editCity);
        $('.reviewCity .reviewCity').text(cityValue);
    }
    if (revPanel && revPanel.reviewState) {
        var stateValue = getVal(editPanel.editState);
        $('.reviewState .reviewState').text(stateValue);
    }
    if (revPanel && revPanel.reviewZipcode) {
        var zipValue = getVal(editPanel.editZipCode);
        $('.reviewZipcode .reviewZipcode').text(zipValue);
    }
    if (revPanel && revPanel.headlineValuesText) {
        var prefix = editPanel.editPrefix && getVal(editPanel.editPrefix).trim();
        var fn = getVal(editPanel.editFirstName).trim();
        var ln = getVal(editPanel.editLastName).trim();
        var sx = getVal(editPanel.editSuffix).trim();
        var pd = getVal(editPanel.editProfessionalDesignation).trim();
        var practiceName = editPanel.editPracticeName && getVal(editPanel.editPracticeName).trim() || '';
        var headline = '';
        if(brochureType && brochureType === 'medicalPractice') {
            headline = practiceName ? practiceName : '';
        } else {
             headline = (prefix ? (prefix + ' '): '') + fn + (ln ? (' ' + ln) : '');
            if (sx) headline += ', ' + sx;
            if (pd) headline += ', ' + pd;
        }
        setVal(revPanel.headlineValuesText, headline);
    }
    globals.functions.setProperty(editPanel, { visible: false });
    globals.functions.setProperty(revPanel, { visible: true });
    globals.functions.setProperty(hcpConformPanel.consentPanel, { visible: true });
    return true;
}

/**
 * @name baseHandleCancelChanges
 * Handles canceling changes made in the editable user information panel.
 * Reverts the view back to the confirmation review panel without saving changes.
 *
 * @param {Object} hcpRegistrationPanel - Reference to the user registration panel (kept for signature consistency)
 * @param {Object} hcpConformPanel - Reference to the user confirmation panel
 * @param {scope} globals
 * @returns {boolean}
 */
function baseHandleCancelChanges(hcpRegistrationPanel, hcpConformPanel, globals) {
    triggerAnalyticsEventOnButton(globals.event.target);
    if (typeof scrollTopOnFormInit === 'function') {
        scrollTopOnFormInit();
    } else if (typeof window !== 'undefined' && window && window.scrollTo) {
        window.scrollTo(0, 0);
    }
    globals.functions.setProperty(hcpConformPanel.editablePanel, { visible: false });
    globals.functions.setProperty(hcpConformPanel.reviewPanel, { visible: true });
    globals.functions.setProperty(hcpConformPanel.consentPanel, { visible: true });
    return true;
}


/**
 * @name initScrollToAcknowledge
 * Enables a checkbox (or checkbox(es) inside a panel) after user scrolls to .mustScrollTo
 *
 * @param {object} optInFieldOrPanel - checkbox OR panel containing checkboxes
 * @param {scope} globals
 * @returns {string}
 */
function initScrollToAcknowledge(optInFieldOrPanel, globals) {
        var RETURN_VALUE = '';
        function setEnabled(comp, flag) {
            if (comp && globals && globals.functions && globals.functions.setProperty) {
                globals.functions.setProperty(comp, { enabled: !!flag });
            }
        }
        setEnabled(optInFieldOrPanel, false);
         var OPT_IN_KEYS = ['infoOptIn2', 'aVConsentandCollectionofPersonalData', 'privacyOptIn', 'electronicSignature', 'practiceInfoOptin', 'attestationBehalfofmyPractice'];
         function triggerSetEnabled(optInFieldOrPanel, toggle) {
             OPT_IN_KEYS.forEach(function (key) {
                 setEnabled(optInFieldOrPanel && optInFieldOrPanel[key], toggle);
             });
         }
        triggerSetEnabled(optInFieldOrPanel, false);
        window.setTimeout(function () {
        var container = document.querySelector('.mustScroll');
        var target = document.querySelector('.mustScrollTo');
        if (!container || !target) {
            return;
        }
        function enableNow() {
            triggerSetEnabled(optInFieldOrPanel, true);
            setEnabled(optInFieldOrPanel, true);
        }
        try {
            var observer = new IntersectionObserver(function (entries) {
                if (entries && entries[0] && entries[0].isIntersecting) {
                    enableNow();
                    observer.disconnect();
                }
            }, { root: container, threshold: 0 });
            observer.observe(target);
        } catch (e) {
            container.addEventListener('scroll', function onScroll() {
                var cBottom = container.scrollTop + container.clientHeight;
                var tOffset = target.offsetTop + target.offsetHeight;
                if (cBottom >= tOffset) {
                    enableNow();
                    container.removeEventListener('scroll', onScroll);
                }
            });
        }
    }, 200);
    return RETURN_VALUE;
}


/**
* Send email to HCP admin and redirect to Thank You page on successful file upload
*/
function fileupload_callback_success(data) {
    window.parent.digitalData.page.form.stepName = 'submit';
    if (analyticspayload.validPayload) {
        analyticspayload.getFormCompletePayload();
    }
    setTimeout(function () { sendGastroEmail();
    }, 300);}
/**
* Error handling if the file upload fails.
*/
function fileupload_callback_error(data) {
   fileUploadErrorHandling(data);
}

function getAbbViePageInfoSafe() {
    try {
        if (window.parent && window.parent !== window && window.parent.AbbViePageInfo) {
            return window.parent.AbbViePageInfo;
        }
    } catch (e) {
    }
    if (window.AbbViePageInfo) {
        return window.AbbViePageInfo;
    }
    var host = window.location.hostname || '';
    var isProdHost = host.indexOf('prod') > -1 || host.indexOf('www') === 0;
    return {
            pagepath: window.location.pathname || '',
            runModes: isProdHost ? 'prod' : 'nonprod'
    };
}

// trigger email for the gastro form using AEM mail trigger functionality

function sendGastroEmail() {
 var pageInfo = getAbbViePageInfoSafe();
 var pagePath = pageInfo.pagepath || '';
 var runModesStr = pageInfo.runModes ? String(pageInfo.runModes) : '';
 var isProd = runModesStr.split(',')[0] === 'prod';
 var inputEl = isProd
   ? document.querySelector('.email-address-prod input')
   : document.querySelector('.email-address-non-prod input');
 var emailAdd = (inputEl && inputEl.value) ? String(inputEl.value).trim() : '';
 passDDGQuestionsGastro();
if (emailAdd) {
         generateEmailPayloadHCP(emailAdd, pagePath, false);
         generateDdgQuizEmail(emailAdd, 'ddg', pagePath, true);
 }
 }

/* Function to show tokens for single page quiz forms */
function passDDGQuestionsGastro() {
    var $question = $('.ddgQuiz .abbv-quizddg-qtoken-q1');
    if ($question.length && typeof generateDDgQuizObject === 'function') {
        generateDDgQuizObject($question[0]);
    }
}

/**,
 * File upload failed scenario handled here
 */
function fileUploadErrorHandling(data) {
    var msg = (data === undefined || data === null) ? 'Upload failed. Please try again.' : String(data);
    var dialog = document.getElementById('myDialog');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'myDialog';
        dialog.innerHTML =
            '<p id="myDialogMsg"></p>' +
            '<button type="button" id="dynClose">Close</button>';
        document.body.appendChild(dialog);
    }
    var msgEl = dialog.querySelector('#myDialogMsg');
    if (msgEl) msgEl.textContent = msg;

    if (typeof dialog.showModal === 'function') {
        dialog.showModal();
    } else {
        alert(msg);
    }
}
(function bindDialogCloseOnce() {
    if (window.__dynCloseBound) return;
    window.__dynCloseBound = true;

    document.addEventListener('click', function(e) {
        var t = e.target;
        if (!t) return;

        if (t.id === 'dynClose') {
            var dialogs = document.querySelectorAll('dialog');
            for (var i = 0; i < dialogs.length; i++) {
                try {
                    if (typeof dialogs[i].close === 'function') dialogs[i].close();
                } catch (err) {}
            }
        }
    });
})();


/**
* @name ibdNavigation
* @description Cloud Visual Editor function for handling navigation
* - Validates the  panels
* - If OK, transitions to next panel + builds review values
*
* @param {string} screen
* @param {object} wizard
* @param {object} hiddenUrlPanel
* @param {scope} globals
* @returns {boolean}
*/
function ibdNavigation(screen, wizard, hiddenUrlPanel, globals) {
 	if(screen && wizard) {
        const HcpLookupPanel = wizard.screen1 && wizard.screen1.HcpLookupPanel || {};
        const hcpRegistrationPanel = wizard.screen2 && wizard.screen2.hcpRegistrationPanel || {};
        const imageUploadPanel = wizard.screen3 && wizard.screen3.imageUploadPanel || {};
        const hcpConformPanel = wizard.screen4.hcpConformPanel || {};
        const npiTextbox = HcpLookupPanel && HcpLookupPanel.npiTextbox || {};
        const emailAddress =  hcpRegistrationPanel && hcpRegistrationPanel.mailingAddressPanel.emailAddress || {};
        let response = false;
        switch (screen) {
            case 'screen2':
                nextButton1Click(wizard, npiTextbox, hcpRegistrationPanel, hiddenUrlPanel, emailAddress, globals);
                break;
            case 'screen3':
                screen3Navigation(wizard, imageUploadPanel, globals);

            break;
            case 'screen4':
                 const response = screen4Navigation(hcpRegistrationPanel, imageUploadPanel, hcpConformPanel, globals);
                  if(response) {
                     globals.functions.setFocus(wizard, 'nextItem');
                   }

           break;
        }
        return true;
    }
    return false;
}

/**
 * name - navigateToPreviousScreen
 * @param {object} wizard
 * @param {object} panelToHide
  * @param {object} panelToShow
 * @param {scope} globals
 **/
function navigateToPreviousScreen(wizard, panelToHide, panelToShow, globals) {
    if (wizard) {
        globals.functions.setFocus(wizard, 'previousItem');
    }
    if(panelToHide && panelToShow) {
        globals.functions.setProperty(panelToHide, { visible: false });
    	globals.functions.setProperty(panelToShow, { visible: true });
    }
    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);
}

/**
* @name resetFileupload
* @description Cloud Visual Editor function for file upload reset
*
* - reset file upload component
* - deleted the stored files and enables the upload button
*
* @param {scope} globals
*/
function resetFileupload(globals) {
   $('.abbv-form-fileupload').each(function(idx, el) {
       let $widget = $(el);
       let fileuploadCfg =  $widget.data('config');
       let cfg = fileuploadCfg && window[fileuploadCfg]
       cfg.filesToUpload = [];
       cfg.allDisplayedFiles = [];
        $($widget).find('input[type="file"]').val('').prop('disabled', false);
        $('button.abbv-formfileupload-start').prop('disabled', false);
        $($widget).find('.fileupload-info').empty().removeClass('abbv-active');
        $($widget).find('.abbv-input-fileContainer').removeClass('abbv-disabled');

   });
}

// Function to get NPI ID and Email Address from local storage
function getNpiAndEmailFromLocalStorage() {
   return {
      npiId: localStorage.getItem(
         "npiId"),
      emailAddress: localStorage
         .getItem("emailAddress")
   };
}

/**
 * @name gets3Data
 * Retrieves previously saved HCP registration data from the S3 servlet
 * using NPI ID and email address. On successful response, it prefills
 * the registration form fields.
 */
function gets3Data() {
   var apiUrl = '/abbviecloud/bin/abbvie/v1/hcpreorder';
   var localStorageData = getNpiAndEmailFromLocalStorage();
   var npiVal = localStorageData.npiId;
   var emailAddress = localStorageData.emailAddress;

   if (!npiVal || !emailAddress) {
      console.error("NPI ID or Email Address is not available in local storage");
      return false;
   }
   var brand = 'gastrohcp';
   var proxyApigeeData = {
      brandName: brand,
      payload: JSON.stringify({
         npiId: npiVal,
         emailId: emailAddress
      }),
      actionType: 'ApigeeHDS',
      originName: baseDetectDeviceType(),
      formAction: 'StaffRegistration',
      version: 'V1',
      formRequest: 'Yes',
      emailAddress: emailAddress,
      npiId: npiVal
   };

   function onFailure(error) {
      console.log('error');
   }

   function onSuccess(data) {
      if (data) {
         ibdReorderPreview(data);
         console.log('success');
      }
      else {
         console.log('error');
      }
   }
   baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), false, onSuccess, onFailure);
   return true;
}

/*
  * @name ibdReorderPreview
  * Prefill prefill ibd data from s3Data
*/

function ibdReorderPreview(
   response) {
   var hcpKey = Object.keys(response).filter(function(key) {
         return key !== "headshotImagePath" && key !== "headshotImageUrl";
      })[0];

   if (!hcpKey) {
      console.log("No HCP data found");
      return;
   }
   var data = response[hcpKey];
   var headline = "";
   if ((data.brochureType || "").toLowerCase() === "practice") {
      headline = data.practiceName || "";
   }
   else {
      headline = [
         data.prefix,
         data.firstName,
         data.lastName,
         data.suffix,
         data.professionalDesignation
      ].filter(Boolean).join(" ");
   }
   var imageUrl = response.headshotImageUrl || "";

   var profileHtml =
      '<div style="text-align:center;">' +
      '<div style="display:inline-block;padding:8px;background:linear-gradient(135deg,#f47920,#e85d04);border-radius:12px;">' +
      '<img src="' + imageUrl +
      '" style="display:block;width:150px;height:150px;object-fit:cover;border-radius:8px;background:#fff;">' +
      '</div>' +
      '<div style="margin-top:10px;font-weight:bold;">' +
      headline +
      '</div>' +
      '</div>';

   setTimeout(function() {
     $('.headlineValuesText').html(profileHtml);
     $('.reviewEmailAddress').html(data.emailAddress || "");
     var quantityNode = guideBridge.resolveNode("$form.reorderPanel.brochureQuantity");
     if (quantityNode && data.quantity) {
        quantityNode.value = String(data.quantity);
     }
   },
   300);
   guideBridge.resolveNode("$form.reorderPanel");
}
/**
 * name - moveToNextPanel
 *
 * @param {scope} globals
 **/
function moveToNextPanel(globals) {
    const currentField = globals.event.target;
    const wizard = currentField && currentField.$parent && currentField.$parent.$parent && currentField.$parent.$parent.$parent;
    if (wizard && !wizard.$activeChild) {
        globals.functions.setFocus(null, 'nextItem');
    }
    if (currentField && currentField.$parent && currentField.$parent.$parent) {
        const step = currentField.$parent.$parent;
        const validations = globals.functions.validate(step);
        if (validations.length === 0 && step.$name === wizard.$activeChild.$name) {
            globals.functions.setFocus(step.$parent, 'nextItem');
        } else if (validations.length > 0 && validations[0] && validations[0].fieldName) {
            let elementById = getElementById(validations[0].fieldName);
            if (elementById.$id) {
                globals.functions.setFocus(elementById);
            } else {
                elementById.$id = elementById.id;
                globals.functions.setFocus(elementById);
            }
        }
        if (!currentField._jsonModel.properties.cssClass.includes('no-analytics')) {
            admp_analytics_functions.analyticsFormInteractionEvent(currentField);
        }
    }
}

/**
 * name - moveToPreviousPanel
 * @param {scope} globals
 **/
function moveToPreviousPanel(globals) {
    const currentField = globals.event.target;
    if (currentField && currentField.$parent && currentField.$parent.$parent && currentField.$parent.$parent.$parent) {
        const wizard = currentField.$parent.$parent.$parent;
        globals.functions.setFocus(wizard, 'previousItem');
    }
    admp_analytics_functions.analyticsFormInteractionEvent(currentField);
}

/**
 * name - ddgquizsubmit
 * @param {scope} globals
 **/
function ddgquizsubmit(globals) {
    const validations = globals.functions.validate();
    if (validations.length === 0) {
        const data = globals.functions.exportData();
        console.log(JSON.stringify(data));
    }

}

/**
 * name - next
 * @param {object} prevButton
 * @param {object} nextButton
 * @param {object} wizard
 * @param {scope} globals
 **/
function next(prevButton, nextButton, wizard, globals) {
    if (wizard.$activeChild) {
        const validations = globals.functions.validate(wizard.$activeChild);
        if (validations.length === 0) {
            globals.functions.setFocus(wizard, 'nextItem');
            const totalPanels = wizard.$items.length;
            // If active panel is last panel, then hide next button
            if (wizard.$activeChild.$index === totalPanels - 1) {
                globals.functions.setProperty(nextButton, {visible: false});
            }
            // If active panel is second panel, then show previous button
            if (wizard.$activeChild.$index === 1) {
                globals.functions.setProperty(prevButton, {visible: true});
            }
            const panelName = wizard.$activeChild.$name;
            console.log(panelName);
        }
    } else {
        globals.functions.setFocus(wizard, 'nextItem');
        next(prevButton, nextButton, wizard, globals);
    }
}

/**
 * name - previous
 * @param {object} prevButton
 * @param {object} nextButton
 * @param {object} wizard
 * @param {scope} globals
 **/
function previous(prevButton, nextButton, wizard, globals) {
    if (wizard.$activeChild) {
        globals.functions.setFocus(wizard, 'previousItem');
        const totalPanels = wizard.$items.length;
        // If active panel is first panel, then hide previous button
        if (wizard.$activeChild.$index === 0) {
            globals.functions.setProperty(prevButton, {visible: false});
        }
        // If active panel is second last panel, then show next button
        if (wizard.$activeChild.$index === totalPanels - 2) {
            globals.functions.setProperty(nextButton, {visible: true});
        }
    } else {
        globals.functions.setProperty(prevButton, {visible: false});
    }
}

/**
 * name - showFrontPanel
 * @param {object} backPanel
 * @param {object} frontPanel
 **/
function showFrontPanel(backPanel, frontPanel) {

    const backPanelId = backPanel.$id;
    const frontPanelId = frontPanel.$id;
    const backPanelElement = document.getElementById(backPanelId);
    const frontPanelElement = document.getElementById(frontPanelId);
    if (backPanelElement && frontPanelElement) {
        backPanelElement.classList.remove('active-side');
        backPanelElement.classList.add('inactive-side');
        frontPanelElement.classList.add('active-side');
        frontPanelElement.classList.remove('inactive-side');
    }
}

/**
 * name - showBackPanel
 * @param {object} backPanel
 * @param {object} frontPanel
 **/
function showBackPanel(backPanel, frontPanel) {
    const backPanelId = backPanel.$id;
    const frontPanelId = frontPanel.$id;
    const backPanelElement = document.getElementById(backPanelId);
    const frontPanelElement = document.getElementById(frontPanelId);
    if (backPanelElement && frontPanelElement) {
        backPanelElement.classList.add('active-side');
        backPanelElement.classList.remove('inactive-side');
        frontPanelElement.classList.remove('active-side');
        frontPanelElement.classList.add('inactive-side');
    }
}

/**
 * updateSummary
 * @param {scope} globals
 */
function updateSummary(globals) {
    var nextStep = globals.form.ddgQuiz.$activeChild;

    var summary = nextStep.$items.find(item => item.$name.startsWith('summary'));

    var answerPanels = summary.$items.filter(item => item.$name.startsWith('answer'));
    if (answerPanels.length === 0) {
        answerPanels = nextStep.$items.filter(item => item.$name.startsWith('answer'));
    }

    var summaryKeys = getCleanedSummaryKeys();
    var cleanedSummary = getCleanedSummaryObject(summaryKeys);

    addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals);
}

/**
 * updateSummaryPreserveSorting
 * @param {scope} globals
 */
function updateSummaryPreserveSorting(globals) {
    var nextStep = globals.form.ddgQuiz.$activeChild;

    var summary = nextStep.$items.find(item => item.$name.startsWith('summary'));

    var answerPanels = summary.$items.filter(item => item.$name.startsWith('answer'));
    if (answerPanels.length === 0) {
        answerPanels = nextStep.$items.filter(item => item.$name.startsWith('answer'));
    }

    var summaryKeys = getCleanedSummaryKeys();
    var cleanedSummary = getCleanedSummaryObjectPreserveSorting(summaryKeys);

    addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals);
}

/**
 * updateSummaryWithSeparatorPreserveSorting
 * @param {string} separator - separator for checkbox values (e.g. comma, and)
 * @param {scope} globals
 */
function updateSummaryWithSeparatorPreserveSorting(separator, globals) {
    var nextStep = globals.form.ddgQuiz.$activeChild;

    var summary = nextStep.$items.find(item => item.$name.startsWith('summary'));

    var answerPanels = summary.$items.filter(item => item.$name.startsWith('answer'));
    if (answerPanels.length === 0) {
        answerPanels = nextStep.$items.filter(item => item.$name.startsWith('answer'));
    }

    var summaryKeys = getCleanedSummaryKeys();
    var cleanedSummary = getCleanedSummaryObjectPreserveSorting(summaryKeys, separator);

    addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals);
}

/**
 * updateSummaryNumericSorting
 * @param {scope} globals
 */
function updateSummaryNumericSorting(globals) {
    var nextStep = globals.form.ddgQuiz.$activeChild;

    var summary = nextStep.$items.find(item => item.$name.startsWith('summary'));

    var answerPanels = summary.$items.filter(item => item.$name.startsWith('answer'));
    if (answerPanels.length === 0) {
        answerPanels = nextStep.$items.filter(item => item.$name.startsWith('answer'));
    }

    var summaryKeys = getCleanedSummaryKeys();
    var cleanedSummary = getCleanedSummaryObjectNumericSorting(summaryKeys);

    addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals);
}

/**
 * updateSummaryWithSeperator
 * @param {string} separator - separator for checkbox values (e.g. comma, and)
 * @param {scope} globals
 */
function updateSummaryWithSeperator(separator, globals) {
    var nextStep = globals.form.ddgQuiz.$activeChild;

    var summary = nextStep.$items.find(item => item.$name.startsWith('summary'));

    var answerPanels = summary.$items.filter(item => item.$name.startsWith('answer'));
    if (answerPanels.length === 0) {
        answerPanels = nextStep.$items.filter(item => item.$name.startsWith('answer'));
    }

    var summaryKeys = getCleanedSummaryKeys();
    var cleanedSummary = getCleanedSummaryObject(summaryKeys, separator);

    addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals);
}

/**
 * updateSummaryOnComponent
 * @param {object} summaryComponent
 * @param {scope} globals
 */
function updateSummaryOnComponent(summaryComponent, globals) {
    const answerPanels = summaryComponent.$items.filter(item => item.$name.startsWith('answer'));
    const summaryKeys = getCleanedSummaryKeys();
    var cleanedSummary = getCleanedSummaryObject(summaryKeys);

    addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals);
}

/**
 * updateSummaryComponentWithCheckboxSeperator
 * @param {object} summaryComponent
 * @param {string} separator
 * @param {scope} globals
 */
function updateSummaryComponentWithCheckboxSeperator(summaryComponent, separator, globals) {
    const answerPanels = summaryComponent.$items.filter(item => item.$name.startsWith('answer'));
    const summaryKeys = getCleanedSummaryKeys();
    var cleanedSummary = getCleanedSummaryObject(summaryKeys, separator);

    addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals);
}

/**
 * updateSummaryOnComponentWithDelay
 * @param {object} summaryComponent
 * @param {scope} globals
 */
function updateSummaryOnComponentWithDelay(summaryComponent, globals) {
    setTimeout(
        function () {
            const answerPanels = summaryComponent.$items.filter(item => item.$name.startsWith('answer'));
            const summaryKeys = getCleanedSummaryKeys();
            var cleanedSummary = getCleanedSummaryObject(summaryKeys);

            addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals);
        }, 150);
}

/**
 * getCleanedSummaryKeys
 */
function getCleanedSummaryKeys() {
    var summaryKeys = [];
    for (const summaryItem in summaryObject) {
        var questionName = summaryItem.replace(/-a.*/, '-a');
        if (!summaryKeys.includes(questionName)) {
            summaryKeys.push(questionName);
        }
    }
    return summaryKeys;
}

/**
 * getCleanedSummaryKeys
 *
 * @param {Array} summaryKeys - array of summary keys
 * @param {string} separator - separator for checkbox values (e.g. comma, and)
 */
function getCleanedSummaryObject(summaryKeys, separator) {
    var cleanedSummaryObject = {};

    summaryKeys.forEach(sumkey => {
        const groups = {};
        Object.keys(summaryObject).sort().forEach(key => {
            if (key.startsWith(sumkey) && (!key.endsWith("a"))) {
                if (!groups[sumkey]) {
                    groups[sumkey] = [];
                }
                if (summaryObject[key] || summaryObject[key] !== '') {
                    groups[sumkey].push(summaryObject[key]);
                }
            }
        });

        separator = separator || ', ';
        if (separator === 'and') {
            separator = ' and ';
        }
        cleanedSummaryObject[sumkey] = summaryObject[sumkey];
        Object.keys(groups).forEach(itemkey => {
            const items = groups[itemkey];
            if (items.length > 1) {
                cleanedSummaryObject[itemkey] = items.join(separator);
            }
        });
    })
    return cleanedSummaryObject;
}

/**
 * getCleanedSummaryObjectPreserveSorting
 *
 * @param {Array} summaryKeys - array of summary keys
 * @param {string} separator - separator for checkbox values (e.g. comma, and)
 */
function getCleanedSummaryObjectPreserveSorting(summaryKeys, separator) {
    var cleanedSummaryObject = {};

    summaryKeys.forEach(sumkey => {
        const groups = {};
        Object.keys(summaryObject).forEach(key => {
            if (key.startsWith(sumkey) && (!key.endsWith("a"))) {
                if (!groups[sumkey]) {
                    groups[sumkey] = [];
                }
                if (summaryObject[key] || summaryObject[key] !== '') {
                    groups[sumkey].push(summaryObject[key]);
                }
            }
        });

        separator = separator || ', ';
        if (separator === 'and') {
            separator = ' and ';
        }
        cleanedSummaryObject[sumkey] = summaryObject[sumkey];
        Object.keys(groups).forEach(itemkey => {
            const items = groups[itemkey];
            if (items.length > 1) {
                cleanedSummaryObject[itemkey] = items.join(separator);
            }
        });
    })
    return cleanedSummaryObject;
}

/**
 * getCleanedSummaryObjectNumericSorting
 *
 * @param {Array} summaryKeys - array of summary keys
 * @param {string} separator - separator for checkbox values (e.g. comma, and)
 */
function getCleanedSummaryObjectNumericSorting(summaryKeys, separator) {
    var cleanedSummaryObject = {};
    summaryKeys.forEach(sumkey => {
        const groups = {};
        Object.keys(summaryObject)
            .sort((a, b) => {
                // Extract the numeric part and sort based on that
                const getNumber = (key) => {
                    const match = key.match(/[aq](\d+)$/);
                    return match ? parseInt(match[1]) : 0;
                };
                return getNumber(a) - getNumber(b);
            })
            .forEach(key => {
                if (key.startsWith(sumkey) && (!key.endsWith("a"))) {
                    if (!groups[sumkey]) {
                        groups[sumkey] = [];
                    }
                    if (summaryObject[key] || summaryObject[key] !== '') {
                        console.log(summaryObject);
                        groups[sumkey].push(summaryObject[key]);
                    }
                }
            });

        separator = separator || ', ';
        if (separator === 'and') {
            separator = ' and ';
        }
        cleanedSummaryObject[sumkey] = summaryObject[sumkey];
        Object.keys(groups).forEach(itemkey => {
            const items = groups[itemkey];
            if (items.length > 1) {
                cleanedSummaryObject[itemkey] = items.join(separator);
            }
        });
    })
    return cleanedSummaryObject;
}

/**
 * addDataToAnswerPanels
 *
 * @param {Array} answerPanels - array of answer panels
 * @param {Array} summaryKeys - array of summary keys
 * @param {Object} cleanedSummary - cleaned summary object
 * @param {scope} globals - form scope
 */
function addDataToAnswerPanels(answerPanels, summaryKeys, cleanedSummary, globals) {
    if (answerPanels.length !== 0) {
        answerPanels.forEach(answerPanel => {
            summaryKeys.forEach(questionObject => {
                var questionName = questionObject.replace(/-a/, '');
                if (answerPanel.answertext._jsonModel.default.includes(questionName)) {
                    var questionText = cleanedSummary[questionObject];
                    if (questionText && (questionText !== "unanswered")) {
                        guideBridge.resolveNode(answerPanel.answertext.$qualifiedName).value = answerPanel.answertext._jsonModel.default.replace(questionName, questionText);
                        globals.functions.setProperty(answerPanel.answertext, {visible: true});
                        globals.functions.setProperty(answerPanel.deftext, {visible: false});
                    } else {
                        globals.functions.setProperty(answerPanel.answertext, {visible: false});
                        globals.functions.setProperty(answerPanel.deftext, {visible: true});
                    }
                }
            });
        });
    }
}

/**
 * replaceOtherOptionInSummary
 * @name replaceOtherOptionInSummary
 * @param {object} answerText - answer text object
 * @param {string} checkboxstring - checkbox value string
 * @param {string} newString - new string to replace
 * @param {string} answerToken - answerToken
 */
function replaceOtherOptionInSummary(answerText, checkboxstring, newString, answerToken) {
    const regex = new RegExp(`\\b${checkboxstring}\\b`, "g");
    const containsOther = regex.test(answerText.$value);
    if (containsOther) {
        var additionalText = summaryObject[answerToken + "-a"];
        guideBridge.resolveNode(answerText.$qualifiedName).value = answerText.$value.replace(regex, newString + " " + additionalText);
    }
}

/**
 * Update the form progress status
 * @name updateProgressStatus
 * @param {object} radioButton1 - radioButton1 form object
 * @param {object} radioButton2a - radioButton2a form object
 * @param {object} radioButton2b - radioButton2b form object
 */
function updateProgressStatus(radioButton1, radioButton2a, radioButton2b) {
    // --- 1. Determine the correct 'treatment status' source dynamically ---
    // If the user is a Care Partner (value '2'), use the Care Partner's radio group (2b).
    // Otherwise, default to the Patient's radio group (2a).
    let radioButton2 = (radioButton1 && radioButton1.$value === '2') ? radioButton2b : radioButton2a;

    // user type constants
    let userTypeMap = {
        1: "I am a Patient",
        2: "I am a Care Partner"
    };
    // treatment status constant
    let treatmentStatusMap = {
        1: "Considering EPKINLY",
        2: "Starting EPKINLY",
        3: "Currently on EPKINLY"
    };

    // update user type
    if (radioButton1 && radioButton1.$value && userTypeMap[radioButton1.$value]) {
        $("#userTypeStep2").html(userTypeMap[radioButton1.$value]); // Step2
        if (radioButton2 && radioButton2.$value) {
            $("#userTypeStep3").html(userTypeMap[radioButton1.$value]); // Step3
            $("#userTypeStep4").html(userTypeMap[radioButton1.$value]); // Step4
        }
    }

    // Step 3 and Step 4- update treatment status
    if (radioButton2 && radioButton2.$value && treatmentStatusMap[radioButton2.$value]) {
        $("#treatmentStatusStep3").html(treatmentStatusMap[radioButton2.$value]); // step3
        $("#treatmentStatusStep4").html(treatmentStatusMap[radioButton2.$value]); // step4
    }

}

/**
 * Show or hide questionnaire
 * @name showOrHideDDGQuestions
 * @param {object} userTypeButton - userType radioButton form object
 * @param {object} treatmentStatusButton1 - treatment status1 radiobutton form object - for patient
 * @param {object} treatmentStatusButton2 - treatment status2 radiobutton form object - for care partner
 * @param {object} questionerPanel - panel with group of checkboxes
 * @param {scope} globals - form scope
 */
function showOrHideDDGQuestions(userTypeButton, treatmentStatusButton1, treatmentStatusButton2, questionerPanel, globals) {

    // --- 1. Determine the correct 'treatment status' source dynamically ---
    // If the user is a Care Partner (value '2'), use the Care Partner's radio group (2b).
    // Otherwise, default to the Patient's radio group (2a).
    let treatmentStatusButton = (userTypeButton && userTypeButton.$value === '2') ? treatmentStatusButton2 : treatmentStatusButton1;

    // Define all possible questions in a single, complete list
    let allQuestions = [
        'campaignQuestion1', 'campaignQuestion2', 'campaignQuestion3', 'campaignQuestion3a', 'campaignQuestion3b',
        'campaignQuestion4', 'campaignQuestion5', 'campaignQuestion6', 'campaignQuestion7', 'campaignQuestion8',
        'campaignQuestion9', 'campaignQuestion10', 'campaignQuestion10a', 'campaignQuestion10b', 'campaignQuestion10c',
        'campaignQuestion10d', 'campaignQuestion11', 'campaignQuestion11a', 'campaignQuestion11b', 'campaignQuestion11c',
        'campaignQuestion12', 'campaignQuestion12a', 'campaignQuestion12b', 'campaignQuestion12c'
    ];

    // Define visibility configurations using a nested object structure.
    // Key format: `userTypeButton_treatmentStatusButton`
    let visibilityConfig = {
        // userType 1: Patient
        '1_1': {visible: ['campaignQuestion1', 'campaignQuestion3a', 'campaignQuestion10a', 'campaignQuestion11a']}, // scenario1 -patient considering EPKINLY
        '1_2': {visible: ['campaignQuestion4', 'campaignQuestion5', 'campaignQuestion10b', 'campaignQuestion11b']}, // scenario2 - patient starting EPKINLY
        '1_3': {visible: ['campaignQuestion6', 'campaignQuestion10c', 'campaignQuestion11c']}, //scenario3 - patient currently on EPKINLY
        // userType 2: Care Partner
        '2_1': {visible: ['campaignQuestion2', 'campaignQuestion3b', 'campaignQuestion10a', 'campaignQuestion12a']}, //scenario4 - care partner considering EPKINLY
        '2_2': {visible: ['campaignQuestion7', 'campaignQuestion8', 'campaignQuestion10b', 'campaignQuestion12b']}, //scenario5 - care partner starting EPKINLY
        '2_3': {visible: ['campaignQuestion9', 'campaignQuestion10d', 'campaignQuestion12c']},  //scenario6 - care partner currently on EPKINLY
    };

    let scenarioKey = `${userTypeButton}_${treatmentStatusButton}`;
    let scenarioSettings = visibilityConfig[scenarioKey];

    if (!scenarioSettings) {
        console.warn(`No configuration found for scenario key: ${scenarioKey}`);
        return;
    }

    // Determine which questions should be visible and which should be hidden
    let visibleQuestions = new Set(scenarioSettings.visible);
    let hiddenQuestions = allQuestions.filter(q => !visibleQuestions.has(q));

    let setProperty = globals.functions.setProperty;

    // Set all visible questions to true
    visibleQuestions.forEach(questionName => {
        if (questionerPanel[questionName]) {
            setProperty(questionerPanel[questionName], {visible: true});
        }
    });

    // Set all other questions to false
    hiddenQuestions.forEach(questionName => {
        if (questionerPanel[questionName]) {
            setProperty(questionerPanel[questionName], {visible: false});
        }
    });
}

/**
 * changeButton action in panel4 - Reset the panel3 and move to Panel2
 * @name changePreviousSelection
 * @param {object} panel3 - panel3 form object
 * @param {scope} globals - form scope
 */
function changePreviousSelection(panel3, globals) {
    globals.functions.reset(panel3); // reset values in panel
    // move to previous panel twice
    moveToPreviousPanel(globals);
    moveToPreviousPanel(globals);
}

/**
 * Populate the CTA buttons based on the user selection
 * @name populateCTAButtons
 * @param {object} userTypeButton - userType radioButton form object (e.g., 1 for patient, 2 for care partner)
 * @param {object} treatmentStatusButton1 - treatmentStatusButton1 - treatment status radiobutton form object for patient
 * @param {object} treatmentStatusButton2 - treatmentStatusButton2 - treatment status radiobutton form object for care partner
 * @param {object} aboutEPKINLYPanel - The panel object for "About EPKINLY"
 * @param {object} patientSupportPanel - The panel object for "Patient Support"
 * @param {object} carePartnerPanel - The panel object for "Care Partner"
 * @param {scope} globals - Form scope containing utility functions
 */
function populateCTAButtons(userTypeButton, treatmentStatusButton1, treatmentStatusButton2,
                            aboutEPKINLYPanel, patientSupportPanel, carePartnerPanel, globals) {
    // --- 1. Determine the correct 'treatment status' source dynamically ---
    // If the user is a Care Partner (value '2'), use the Care Partner's radio group (2b).
    // Otherwise, default to the Patient's radio group (2a).
    let treatmentStatusButton = (userTypeButton && userTypeButton.$value === '2') ? treatmentStatusButton2 : treatmentStatusButton1;

    let setProperty = globals.functions.setProperty;
    // First, set all panels to hidden by default for clear state management
    setProperty(aboutEPKINLYPanel, {visible: false});
    setProperty(patientSupportPanel, {visible: false});
    setProperty(carePartnerPanel, {visible: false});
    // Use an object lookup for a cleaner switch between user types
    let panelToShow = {
        1: patientSupportPanel, // User Type 1 is Patient -> Show Patient Support
        2: carePartnerPanel     // User Type 2 is Care Partner -> Show Care Partner panel
    };

    if (treatmentStatusButton.$value == 1) {
        // Treatment status is 'considering'
        setProperty(aboutEPKINLYPanel, {visible: true});
    } else if (treatmentStatusButton.$value == 2 || treatmentStatusButton.$value == 3) {
        // Treatment status is 'starting' or 'currently in treatment'

        // Show the panel specific to the user type (Patient Support OR Care Partner panel)
        let specificPanel = panelToShow[userTypeButton];
        if (specificPanel) {
            setProperty(specificPanel, {visible: true});
        }
    }
}

/**
 * Gets the current time in the 'America/Chicago' timezone and formats it
 * into the 'MM/DD/YYYY HH:MM:SS' format.
 * @name getCSTFormattedTime
 * @param {scope} globals
 * @returns {string} The formatted CST/CDT time string.
 */
function getCSTFormattedTime(globals) {
    // 1. Get the current date and time (as UTC internally)
    let now = new Date();

    // 2. Define the target timezone and formatting options
    let options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false, // Use 24-hour format
        timeZone: 'America/Chicago' // Forces the output to be in Central Time
    };

    // 3. Format the date using the 'en-US' locale (which naturally uses MMDDYYYY order)
    let formatter = new Intl.DateTimeFormat('en-US', options);

    // The output from formatter.format(now) will be a string like: "11/21/2025, 05:40:00"
    let formattedStringWithComma = formatter.format(now);

    // 4. Remove the comma and space in the middle to match the exact requested format: MM/DD/YYYY HH:MM:SS
    let formattedString = formattedStringWithComma.replace(', ', ' ');

    return formattedString;
}

/**
 * Get the current date and time and convert it to CST and update the campaign question and submit form
 * @name ddgQuizFormSubmission
 * @param {object} responseText - responseText form object
 * @param {scope} globals - Form scope containing utility functions
 */
function ddgQuizFormSubmission(responseText, globals) {
    guideBridge.resolveNode(responseText.$qualifiedName).value = getCSTFormattedTime(globals);
    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();
    // recaptcha will be validated after the form submission
    if (errors.length === 0 ||
            (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        fetchObservabilityAndSubmit(globals, formData)
    }
}

/**
 * showEmailPanelAndPdfDownloadOnCssClassClicked
 * @name showEmailPanelAndPdfDownloadOnCssClassClicked
 * @param {object} sendNowButton
 * @param {object} [email] email input field, optional
 * @param {scope} globals
 */
function showEmailPanelAndPdfDownloadOnCssClassClicked(sendNowButton, email, globals) {
    $(".abbv-emaill-trigger").click(function (e) {
        globals.functions.setProperty(globals.form.ddgQuiz.summary.emailAndPdfPanel.emailPanel.buttonspanel, {'visible': false});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.emailAndPdfPanel.emailPanel.emailSuccessPanel, {'visible': false});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.emailAndPdfPanel.emailPanel.sendEmailPanel, {'visible': true});
    });
    $(".abbv-base-quizddg-downloadpdf-button").click(function (e) {
        baseDdgQuizDownloadPdf(sendNowButton, email);
    });
}

/**
 * Set responseText value from the Session storage
 * @name setResponseTextValueFromSessionStorage
 * @param {object} responseText - responseText form object
 * @param {String} sessionKey - session storage key
 * @param {scope} globals - Form scope containing utility functions
 */
function setResponseTextValueFromSessionStorage(responseText, sessionKey, globals) {
    var sessionKeyValue = getSessionStorage(sessionKey);
    if (sessionKeyValue && sessionKeyValue !== 'undefined') {
        guideBridge.resolveNode(responseText.$qualifiedName).value = sessionKeyValue;
    }
}

/**
 * symptomsQuizEmailSubmit
 * @name symptomsQuizEmailSubmit
 * @param {object} emailAddress
 * @description IdentifyEPI Symptoms Quiz Email Submission
 * @param {scope} globals
 */
function symptomsQuizEmailSubmit(emailAddress, globals) {
    var formData = globals.functions.exportData();
    formData.Registration.Campaign.Campaigns = formData.Registration.Campaign.Campaigns.filter(
        item => item.ResponseId !== undefined &&
        item.ResponseId !== null &&
        !["10003", "10011", "10012", "10013"].includes(item.QuestionId)
    );
    formData.Registration.Consumer = {
        TransactionId: formData.Registration.Consumer.TransactionId,
        Email: [{
            EmailAddress: emailAddress.$value
        }]
    };
    var errors = [];
    errors = errors.concat(globals.functions.validate(globals.form.ddgQuiz.Question1));
    errors = errors.concat(globals.functions.validate(globals.form.ddgQuiz.Question2));
    errors = errors.concat(globals.functions.validate(globals.form.ddgQuiz.Question3));
    errors = errors.concat(globals.functions.validate(globals.form.ddgQuiz.Question4));
    errors = errors.concat(globals.functions.validate(globals.form.ddgQuiz.Question5));
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('button.sendEmailBtn').prop('disabled', true);
        globals.functions.submitForm(formData, false, 'application/json');
    }
}

/**
 * identifyEpiSignup
 * @name identifyEpiSignup
 * @description IdentifyEPI Signup
 * @param {scope} globals
 */
function identifyEpiSignup(globals) {
    var formData = globals.functions.exportData();
    formData.Registration.Campaign.Campaigns = formData.Registration.Campaign.Campaigns.filter(
        item => item.ResponseId !== undefined &&
        item.ResponseId !== null &&
        !["10018"].includes(item.QuestionId)
    );
    var errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, formData);
    }
}

/**
 * identifyEpiSubmitSuccessHandler
 * @name identifyEpiSubmitSuccessHandler
 * @param {object} submitType
 * @param {object} emailAndThankyouPanel
 * @param {scope} globals
 */
function identifyEpiSubmitSuccessHandler(submitType, emailAndThankyouPanel, globals) {
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    const response = globals.event.payload.body;
    const fullAPIResponse = JSON.parse(response.metadata.fullApiResponse);
    if (submitType && submitType.$value === 'SendEmail') {
        $('button.sendEmailBtn').prop('disabled', false);
        var status = fullAPIResponse.RegistrationResponse.IsStatusSuccessful;
        if (status == 'true'){
            globals.functions.setProperty(emailAndThankyouPanel.btnsPanel, {visible: false});
            globals.functions.setProperty(emailAndThankyouPanel.thankyouPanel, {visible: true});
            globals.functions.setProperty(emailAndThankyouPanel.emailPanel, {visible: false});
        } else {
            customSubmitErrorHandler(globals)
        }
    } else if (submitType && submitType.$value === 'SignUp') {
        $('.submit.button button').prop('disabled', false);
        if (response && response.redirectUrl) {
            redirectToThankYouPage(response.redirectUrl);
        } else {
            console.error("No redirect URL found in the response.");
        }
    } else {
        customSubmitErrorHandler(globals)
    }
}


/**
 * getDepressionSymptomLevel
 * @name getDepressionSymptomLevel
 * @description determine depression symptom level for Vraylar depression symptom quiz
 * @param {number} finalScore
 */
function getDepressionSymptomLevel(finalScore) {
    const score = Number(finalScore);

    if (Number.isNaN(score)) return "";

    if (score >= 0 && score <= 4) {
        return "Minimal or none";
    } else if (score >= 5 && score <= 9) {
        return "Mild";
    } else if (score >= 10 && score <= 14) {
        return "Moderate";
    } else if (score >= 15 && score <= 19) {
        return "Moderately severe";
    } else if (score >= 20 && score <= 27) {
        return "Severe";
    } else {
        return "Out of range";
    }
}

/**
 * calculateDepressionScore
 * @name calculateDepressionScore
 * @description calculate depression score for Vraylar depression symptom quiz
 * @param {object} wizard
 * @param {number} noOfQuestions
 */
function calculateDepressionScore(wizard, noOfQuestions) {
    let total = 0;

    for (let i = 1; i <= noOfQuestions; i++) {
        const q = wizard["Question" + i];
        const response = q && q["campaign_" + i] 
                           && q["campaign_" + i]["campaign_" + i + "_responseid"] 
                           && q["campaign_" + i]["campaign_" + i + "_responseid"].$value;
        total += Number(response) - 1;
    }

    return total;
}

/**
 * updateFinalDepressionResult
 * @name updateFinalDepressionResult
 * @description update final depression score, determines the severity level on the summary page
 * @param {object} wizard
 * @param {number} noOfQuestions
 * @param {string} depressionScoreClassname
 * @param {string} severityIndicatorClassname
 * @param {string} dateClassname
 */
function updateFinalDepressionResult(wizard, noOfQuestions, depressionScoreClassname, severityIndicatorClassname, dateClassname) {
    if (!wizard) return;

    const finalScore = calculateDepressionScore(wizard, noOfQuestions);
    const severity = getDepressionSymptomLevel(finalScore);
    const formattedDate = getCSTFormattedTime().split(' ')[0];
    const $scoreEl = $('.' + depressionScoreClassname);
    const $severityEl = $('.' + severityIndicatorClassname);
    const $dateEl = $('.' + dateClassname);
    var isMinimalSeverity = severity === "Minimal or none";
    ddgType2["sqSevMinimal"] = isMinimalSeverity ? "selected" : "unselected";
    ddgType2["sqSevHigher"]  = isMinimalSeverity ? "unselected" : "selected";

    if ($scoreEl) $scoreEl.text(finalScore);
    if ($severityEl) $severityEl.text(severity);
    if ($dateEl) $dateEl.text(formattedDate);
}

/**
 * vraylarDSQSubmitSuccessHandler
 * @name vraylarDSQSubmitSuccessHandler
 * @param {object} emailPanel 
 * @param {object} thankyouPanel
 * @param {scope} globals
 */
function vraylarDSQSubmitSuccessHandler(emailPanel, thankyouPanel, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    const response = globals.event.payload.body;
    const fullAPIResponse = JSON.parse(response.metadata.fullApiResponse);
    var status = fullAPIResponse.isStatusSuccessful;
    if (status == 'true'){
        globals.functions.setProperty(emailPanel, {visible: false});
        globals.functions.setProperty(thankyouPanel, {visible: true});
    } else {
        customSubmitErrorHandler(globals)
    }
}
/**
 * baseValidateFirstName
 * @name baseValidateFirstName
 * @param {string} firstName
 * @return {boolean}
 */
function baseValidateFirstName(firstName) {
    const userNameExp = /^\s*[a-zA-Z-_.‘’#,'+&]+(?:[\s-][a-zA-Z-_.‘’#,'+&]+)*\s*$/;
    return (userNameExp.test(firstName) ? true : false);
}

/**
 * baseValidateLastName
 * @name baseValidateLastName
 * @param {string} lastName
 * @return {boolean}
 */
function baseValidateLastName(lastName) {
    const userNameExp = /^\s*[a-zA-Z-_.‘’#,'+&]+(?:[\s-][a-zA-Z-_.‘’#,'+&]+)*\s*$/;
    return (userNameExp.test(lastName) ? true : false);
}

/**
 * baseValidateNewPassword
 * @name baseValidateNewPassword
 * @param {string} password
 * @returns {boolean}
 */
function baseValidateNewPassword(password) {
    const passwordExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$@!%|&)\-^(*])[A-Za-z\d#$@!%|&)^\-(*]{8,16}$/;
    return (passwordExp.test(password) ? true : false);
}

/**
 * base64Encode
 * @name base64Encode
 * @param {string } str
 * @returns {string} base64 encoded string
 */
function base64Encode(str) {
    return btoa(str);
}

/**
 * baseTogglePasswordVisibility
 * @name baseTogglePasswordVisibility
 * @param {object} passwordBox
 * @param {scope} globals
 */
function baseTogglePasswordVisibility(passwordBox, globals) {
    const $input = $('#' + passwordBox.$id + '-widget');
    $input.prop('type', $input.prop('type') === 'password' ? 'text' : 'password');
}

/**
 * baseToggleCustomPasswordFieldVisibility
 * @name baseToggleCustomPasswordFieldVisibility
 * @param {string} customFieldClass
 */
function baseToggleCustomPasswordFieldVisibility(customFieldClass) {
    var passwordBox = document.querySelector('.' + customFieldClass + ' input');
    passwordBox.type = passwordBox.type === "password" ? "text" : "password";
}

/**
 * baseTogglePasswordVisibility
 * @name baseTogglePasswordVisibility
 * @param {object} checkbox
 */
function baseTogglePasswordVisibilityClickEvent(checkbox) {
    const input = checkbox.closest(".cmp-adaptiveform-textinput")
        .querySelector(".password-field__widget");
    if (input) {
        input.type = checkbox.checked ? "text" : "password";
    }
}

/**
 * baseValidateAddress
 * @name baseValidateAddress
 * @param {string} address
 * @return {boolean}
 */
function baseValidateAddress(address) {
    const addressExp = /^\s*[a-zA-Z0-9-_.‘’#,'+&]+(?:[\s-][a-zA-Z0-9-_.‘’#,'+&]+)*\s*$/;
    return (addressExp.test(address) ? true : false);
}

/**
 * @name baseValidateCity
 * @param {string} city
 * @param {scope} globals
 * @returns {boolean}
 */
function baseValidateCity(city, globals) {
    const cityExp = /^\s*[a-zA-Z0-9-_.'‘’,]+(?:[\s-][a-zA-Z0-9-_.'‘’,]+)*\s*$/;
    return (cityExp.test(city));
}

/**
 * name - baseValidateEmail
 * @param {object} email
 * @param {string} errMsg
 * @param {scope} globals
 * @return {boolean}
 **/
function baseValidateEmail(email, errMsg, globals) {
    const emailValue = email.$value ? email.$value.trim() : '';
    const emailExp = /^[A-Z0-9][A-Z0-9._-]{0,63}@(?:(?=[A-Z0-9-]{1,63}\.)[A-Z0-9]+(?:-[A-Z0-9]+)*\.){1,8}[A-Z]{2,63}$/i;

    if (!emailValue.length) {
        globals.functions.setProperty(email, {'errorMessage': errMsg});
        return false;
    }

    //skyrizi/humira/botoxone login pages continue to use legacy validation to allow potential current users with invalid characters to continue.
    //This check can be removed when login is removed from those sites
    if (window.parent.location.pathname.endsWith('/login') ||
        window.parent.location.pathname.endsWith('/log-in') ||
        window.parent.location.pathname.endsWith('/sign-in')) {
        var isValid = emailExp.test(emailValue);
        if (isValid) {
            return true;
        } else {
            globals.functions.setProperty(email, {'errorMessage': errMsg});
            return false;
        }
    } else {
        //New validation for all non-login email cases.
        //Regex doesn't cover everything - add additional rules
        if (emailValue.length > 254) {
            globals.functions.setProperty(email, {'errorMessage': errMsg});
            return false;
        }
        if (emailValue.includes('..') || emailValue.includes('.-') || emailValue.includes('-.') || emailValue.includes('--')) {
            globals.functions.setProperty(email, {'errorMessage': errMsg});
            return false;
        }

        var isValid = emailExp.test(emailValue);
        if (isValid) {
            return true;
        } else {
            globals.functions.setProperty(email, {'errorMessage': errMsg});
            return false;
        }
    }
}

/**
 * name - baseValidateEmailNoErrorMsg
 * @param {object} email
 * @param {scope} globals
 * @return {boolean}
 **/
function baseValidateEmailNoErrorMsg(email, globals) {
    const emailValue = email.$value ? email.$value.trim() : '';
    const emailExp = /^[A-Z0-9][A-Z0-9._-]{0,63}@(?:(?=[A-Z0-9-]{1,63}\.)[A-Z0-9]+(?:-[A-Z0-9]+)*\.){1,8}[A-Z]{2,63}$/i;

    if (!emailValue.length) {
        return true;
    }
    if (emailValue.length > 254) {
        return false;
    }
    if (emailValue.includes('..') || emailValue.includes('.-') || emailValue.includes('-.') || emailValue.includes('--')) {
        return false;
    }
    return emailExp.test(emailValue);
}

/**
 * baseCompareEmailsValidation
 * @name baseCompareEmailsValidation
 * @param {object} email
 * @param {object} confirmEmail
 * @param {string} errMsg
 * @param {scope} globals
 */
function baseCompareEmailsValidation(email, confirmEmail, errMsg, globals) {
    if (email.$value && confirmEmail.$value && email.$value !== confirmEmail.$value) {
        globals.functions.setProperty(confirmEmail, {'errorMessage': errMsg});
        return false;
    }
    return true;
}

/**
 * baseValidateZipcodeAndRestrictInvalidCharacters
 * @name baseValidateZipcodeAndRestrictInvalidCharacters
 * @param {object} zipCode
 * @param {scope} globals
 * @return {boolean}
 */
function baseValidateZipcodeAndRestrictInvalidCharacters(zipCode, globals) {
    const zipcodeExp = /^(?!0{5})[0-9]{5}$/;
    const zipCodeValue = zipCode.$value;
    const updateValue = zipCodeValue.replace(/[^0-9]/g, '');
    globals.functions.setProperty(zipCode, {'value': updateValue});
    return zipcodeExp.test(updateValue) ? true : false;
}

/**
 * baseValidatePRZipcode
 * @name baseValidatePRZipcode
 * @param {string} zipCode
 * @return {boolean}
 */
function baseValidatePRZipcode(zipCode) {
    zipCode = zipCode.trim();
    var loc = Number(zipCode.substring(2));
    return baseValidateZipcode(zipCode) && zipCode.startsWith('00') &&
        ((loc >= 600 && loc <= 799) || (loc >= 900 && loc <= 999));
}

/**
 * baseValidateUSZipcode
 * @name baseValidateUSZipcode
 * @param {object} zipCode
 * @param {object} errMsgPrZip
 * @param {string} errMsg
 * @param {scope} globals
 * @return {boolean}
 */
function baseValidateUSZipcode(zipCode, errMsgPrZip, errMsg, globals) {
    if (baseValidatePRZipcode(zipCode.$value)) {
        globals.functions.setProperty(zipCode, {'errorMessage': errMsgPrZip.$label.value});
        return false;
    } else if (!baseValidateZipcode(zipCode.$value)) {
        globals.functions.setProperty(zipCode, {'errorMessage': errMsg});
        return false;
    }
    return true;
}

/**
 * baseValidateZipcode
 * @name baseValidateZipcode
 * @param {string} zipcode
 * @return {boolean}
 */
function baseValidateZipcode(zipcode) {
    const zipcodeExp = /^(?!0{5})[0-9]{5}$/;
    return zipcodeExp.test(zipcode) ? true : false;
}

/**
 * baseAllowOnlyDecimalCharacters
 * @name baseAllowOnlyDecimalCharacters
 * Subscribes to the input and propertychange events of the element to restrict input to decimal characters only.
 * @param {object} element - The element to apply the restriction on.
 */
function baseAllowOnlyDecimalCharacters(element) {
    const jqueryElement = $('#' + element.$id + '-widget');
    jqueryElement.on('propertychange input', function () {
        const updateValue = jqueryElement.val().replace(/[^0-9]/g, '');
        jqueryElement.val(updateValue);
    });
}

/**
 * baseValidateSavingsCardId
 * @name baseValidateSavingsCardId
 * @param {object} savingsCardId
 * @return {boolean}
 */
function baseValidateSavingsCardId(savingsCardId) {
    const val = savingsCardId.$value;
    return val && (val.length === 12 || val.length === 11 && baseValidateAlphaNumeric(val));
}

function baseValidateAlphaNumeric(savingCardId) {
    const savingsCardIdExp = /^[a-zA-Z0-9]+$/;
    return savingsCardIdExp.test(savingCardId) ? true : false;
}

/**
 * baseValidatePhoneNumber
 * @name baseValidatePhoneNumber
 * @param {string} phoneString
 * @return {boolean}
 */
function baseValidatePhoneNumber(phoneString) {
    const phoneNumberExp = /^([0-1]\s{1})?[2-9]{1}[0-9]{2}?[-]\d{3}?[-]\d{4}$|^([2-9]{1})(\d{9})$|^([0-1]\s{1})?([2-9]{1}[0-9]{2})?[\s]\d{3}?[\s]\d{4}$|^([0-1]\s{1})?\([2-9]{1}[0-9]{2}\)\d{3}?[-]\d{4}$|^([0-1]\s{1})?\([2-9]{1}[0-9]{2}\)[\s]\d{3}?[\s][-][\s]\d{4}$/;
    return (phoneNumberExp.test(phoneString) ? true : false);
}

/**
 * baseValidatePhoneNumberAndRestrictInvalidCharacters
 * @name baseValidatePhoneNumberAndRestrictInvalidCharacters
 * @param {object} phone
 * @param {scope} globals
 * @return {boolean}
 */
function baseValidatePhoneNumberAndRestrictInvalidCharacters(phone, globals) {
    const phoneNumberExp = /^([0-1]\s{1})?[2-9]{1}[0-9]{2}?[-]\d{3}?[-]\d{4}$|^([2-9]{1})(\d{9})$|^([0-1]\s{1})?([2-9]{1}[0-9]{2})?[\s]\d{3}?[\s]\d{4}$|^([0-1]\s{1})?\([2-9]{1}[0-9]{2}\)\d{3}?[-]\d{4}$|^([0-1]\s{1})?\([2-9]{1}[0-9]{2}\)[\s]\d{3}?[\s][-][\s]\d{4}$/;
    const phoneValue = phone.$value;
    const updateValue = phoneValue.replace(/[^0-9]/g, '');
    globals.functions.setProperty(phone, {'value': updateValue});
    return phoneNumberExp.test(updateValue) ? true : false;
}

/**
 * baseValidatePhoneNumberAndRestrictInvalidCharactersAndHideShowPanel
 * @name baseValidatePhoneNumberAndRestrictInvalidCharactersAndHideShowPanel
 * @param {object} phone
 * @param {object} panel
 * @param {scope} globals
 * @return {boolean}
 */
function baseValidatePhoneNumberAndRestrictInvalidCharactersAndHideShowPanel(phone, panel, globals) {
    const valid = baseValidatePhoneNumberAndRestrictInvalidCharacters(phone, globals);
    if (valid) {
        globals.functions.setProperty(panel, {visible: true});
        return true;
    } else {
        globals.functions.setProperty(panel, {visible: false});
        return false;
    }
}

/**
 * baseValidateDateFormat
 * @name baseValidateDateFormat
 * @param {Object} date date INPUT field
 * @param {String=} errMsg error message
 * @param {scope} globals
 * @returns {boolean}
 */
function baseValidateDateFormat(date, errMsg, globals) {
    if (!errMsg) {
        errMsg = 'Invalid date';
    }
    if (baseIsValidDate(date, globals)) {
        return true;
    } else {
        globals.functions.setProperty(date, {'errorMessage': errMsg});
        return false;
    }
}

/**
 * Validate that a date input is formatted MM/DD/YYYY and is a future date.
 * "Today" is considered  future by default.
 *
 * @param {Object} date - The INPUT field object with a .$value string (MMDDYYYY).
 * @param {String=} errMsg - Error message to set when invalid.
 * @param {scope} globals
 * @returns {boolean} - true if the date is valid and in the future; false otherwise.
 */
function baseValidateFutureDateFormat(date, errMsg, globals) {
    var message = errMsg || 'Invalid date';
    // invalid date or date string
    if (!date || typeof date.$value !== 'string') {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    }

    // validate the base date - also do date format as MM/DD/YYYY
    if (!baseIsValidDate(date, globals)) {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    }

    // Validate date format MM/DD/YYYY and future-ness (today is future)
    if (date.$value.length === 10) {
        var future = isValidFutureDate(date.$value, true);
        if (!future) {
            globals.functions.setProperty(date, {errorMessage: message});
        }
        return future;
    }
}
/**
 * Validate that a date input is formatted MM/DD/YYYY and is a future date.
 * given option to include today's date as future or not
 * @name baseValidateFutureDateWithTodayOption
 * @param {Object} date - The INPUT field object with a .$value string (MMDDYYYY).
 * @param {String} errMsg - Error message to set when invalid.
 * @param {boolean} includeToday - tp include today as future date or not
 * @param {scope} globals
 * @returns {boolean} - true if the date is valid and in the future; false otherwise.
 */
function baseValidateFutureDateWithTodayOption(date, errMsg, includeToday, globals) {
    var message = errMsg || 'Invalid date';
    // invalid date or date string
    if (!date || typeof date.$value !== 'string') {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    }

    // validate the base date - also do date format as MM/DD/YYYY
    if (!baseIsValidDate(date, globals)) {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    }

    // Validate date format MM/DD/YYYY and future-ness (today is future)
    if (date.$value.length === 10) {
        var future = isValidFutureDate(date.$value, includeToday);
        if (!future) {
            globals.functions.setProperty(date, {errorMessage: message});
        }
        return future;
    }
}
/**
* Validate that a date input is formatted MM/DD/YYYY and is a past date.
* @param {Object} date - The INPUT field object with a .$value string (MMDDYYYY).
* @param {String} errMsg - Error message to set when invalid.
* @param {String} generic -Generic Error message to set when invalid.
* @param {scope} globals
* @returns {boolean} - true if the date is valid and in the past; false otherwise.
*/
function baseValidateTodayOrPastDate(date, errMsg, generic, globals) {
    var message = errMsg || 'Invalid date';
    var genericMessage = generic || 'Invalid date';
    var today = new Date;
    today.setHours(0, 0, 0, 0);
    var pasdate = new Date(date.$value);
    // invalid date or date string
    if (!date || typeof date.$value !== 'string') {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    }
    // validate the base date - also do date format as MM/DD/YYYY
    if (!baseIsValidDate(date, globals)) {
        globals.functions.setProperty(date, {errorMessage: genericMessage});
        return false;
    }
    if (pasdate > today) {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    } else {
        return true;
    }
}

/**
 * Validate that a date input is formatted MM/DD/YYYY and is a past date.
 * @param {Object} date - The INPUT field object with a .$value string (MMDDYYYY).
 * @param {String=} errMsg - Error message to set when invalid.
 * @param {scope} globals
 * @returns {boolean} - true if the date is valid and in the past; false otherwise.
 */
function baseValidatePastDateFormat(date, errMsg, globals) {
    var message = errMsg || 'Invalid date';
    var today = new Date;
    today.setHours(0, 0, 0, 0);
    var pasdate = new Date(date.$value);
    // invalid date or date string
    if (!date || typeof date.$value !== 'string') {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    }
    // validate the base date - also do date format as MM/DD/YYYY
    if (!baseIsValidDate(date, globals)) {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    }
    if (pasdate >= today) {
        globals.functions.setProperty(date, {errorMessage: message});
        return false;
    } else {
        return true;
    }
}

/**
 * Validates MM/DD/YYYY and checks whether it's in the future relative to local "today".
 * Avoids Date(string) parsing; uses explicit numeric components.
 *
 * @param {string} dateString - e.g., "12/25/2026"
 * @param {boolean} allowToday - if true, "today" is considered valid; default false.
 * @returns {boolean} true if valid format & (future or today when allowed), false otherwise.
 */
function isValidFutureDate(dateString, allowToday) {
    if (typeof allowToday !== 'boolean') {
        allowToday = false;
    }

    // Basic format check (two-digit month/day, four-digit year)
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateString);
    if (!m) {
        return false;
    }

    var month = Number(m[1]);
    var day = Number(m[2]);
    var year = Number(m[3]);

    // Range checks
    if (year < 1000 || year > 9999) {
        return false;
    }
    if (month < 1 || month > 12) {
        return false;
    }


    var dim = daysInMonth(year, month);
    if (day < 1 || day > dim) {
        return false;
    }

    // Construct date safely (local timezone), normalize to midnight
    var inputDate = new Date(year, month - 1, day);
    inputDate.setHours(0, 0, 0, 0);

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var inputTs = inputDate.getTime();
    var todayTs = today.getTime();

    return allowToday ? (inputTs >= todayTs) : (inputTs > todayTs);
}

/**
 * Returns the number of days in a given month for a specific year.
 * Handles leap years for February.
 *
 * @param {number} y - The full year (e.g., 2026).
 * @param {number} mo - The month number (1 = January, 12 = December).
 * @returns {number} The number of days in the specified month.
 */
function daysInMonth(y, mo) {
    if (mo === 2) {
        var isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
        return isLeap ? 29 : 28;
    }
// Jan..Dec: [31, 28/29 handled above, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    var monthDays = [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return monthDays[mo - 1];
}

function baseValidateInstitution(institution) {
    const institutionExp = /^\s*[a-zA-Z-_.‘’#,'+&]+(?:[\s-]+[a-zA-Z-_.‘’#,'+&]+)*\s*$/;
    return institutionExp.test(institution);
}

function baseIsValidDate(date, globals) {
    const dateExp = /^((((0[13578]|1[02])?([\/\s])(0[1-9]|[12][0-9]|3[01])?([\/\s])(19|20)[0-9]{2})|((0[469]|11)?([\/\s])(0[1-9]|[12][0-9]|30)?([\/\s])(19|20)[0-9]{2})|((02)?([\/\s])(0[1-9]|1[0-9]|2[0-8])?([\/\s])(19|20)[0-9]{2})|((02)?([\/\s])29?([\/\s])(((19|20)(04|08|[2468][048]|[13579][26]))|2000)))|(((0[13578]|1[02])(0[1-9]|[12][0-9]|3[01])(19|20)[0-9]{2})|((0[469]|11)(0[1-9]|[12][0-9]|30)(19|20)[0-9]{2})|((02)(0[1-9]|1[0-9]|2[0-8])(19|20)[0-9]{2})|((02)29(((19|20)(04|08|[2468][048]|[13579][26]))|2000))))$/;
    let isValid = false;

    let updatedValue = date.$value;
    if (updatedValue.length && dateExp.test(updatedValue)) {
        if (updatedValue.length === 8) {
            updatedValue = updatedValue.slice(0, 2) + '/' + updatedValue.slice(2, 4) + '/' + updatedValue.slice(4, 8);
        } else if (updatedValue.indexOf(' ') > -1) {
            updatedValue = updatedValue.split(' ').join('/');
        }
        isValid = new Date(updatedValue).getFullYear() >= 1900;
        if (isValid) {
            updateDateValue(date, updatedValue, globals);
        }
    }
    return isValid;
}

/**
 * @name updateDateValue
 * @param {Object} date
 * @param {updatedValue} updatedValue
 * @param {scope} globals
 * @returns {boolean}
 */
function updateDateValue(date, updatedValue, globals) {
    globals.functions.setProperty(date, {'value': updatedValue});
}

/**
 * @name baseIsLegalAge
 * @param {Object} date INPUT field
 * @param {String=} errMsg error message
 * @param {Number=} legalAge
 * @param {scope} globals
 * @returns {boolean}
 */
function baseIsLegalAge(date, errMsg, legalAge, globals) {
    if (!errMsg) {
        errMsg = 'Invalid legal age';
    }
    if (!legalAge) {
        legalAge = 18;
    }
    if (!baseIsValidDate(date, globals)) {
        globals.functions.setProperty(date, {'errorMessage': errMsg});
        return false;
    }
    var dob;
    var dateValue = date.$value;
    if (dateValue.indexOf('/') === -1) {
        dob = dateValue.slice(0, 2) + '/' + dateValue.slice(2, 4) + '/' + dateValue.slice(4, 8);
    } else {
        dob = dateValue;
    }

    if (baseCalculateAge(new Date(dob)) >= legalAge) {
        return true;
    } else {
        globals.functions.setProperty(date, {'errorMessage': errMsg});
        return false;
    }
}

/**
 * Calculate age based on date
 * @param {Object} date Date object
 * @returns {number}
 */
function baseCalculateAge(date) {
    var today = new Date();
    var age = today.getFullYear() - date.getFullYear();
    var m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
        age--;
    }
    return age;
}

/* Method to add "/" in Date format */
function baseAddSlashtoDate(targetClass) {
    var invalidcharacters = new RegExp(/[^0-9]/);
    $('.' + targetClass + ' input').on('keypress paste', function (e) {
        if (e.type === 'keypress' && (e.shiftKey || e.which <= 47 || e.which >= 58)) {
            return false;
        }
        //when user pastes using 'ctrl +v'
        //we should not be  the delete the last charcter
        //so checking wheather key press is 'ctrl' or 'v' in below if
        if (e.type === 'paste' || e.which === 17 || e.which === 86) {
            if (this.value.charAt(this.value.length - 1) === 'v') {
                this.value = this.value.substring(0, this.value.length - 1);
            } else {
                if (e.originalEvent.clipboardData) {
                    var copiedDate = e.originalEvent.clipboardData.getData('text');
                    var unformatDate = copiedDate.replace(/[^0-9]/g, '');
                    if (unformatDate.length === 8) {
                        this.value = unformatDate.slice(0, 2) + '/' + unformatDate.slice(2, 4) + '/' + unformatDate.slice(4, 8);
                        e.preventDefault();
                    }
                }
            }

        } else if (e.type === 'keypress') {
            if (invalidcharacters.test(e.key) && e.which !== 8) {
                if (this.value.length !== 10 || invalidcharacters.test(this.value.charAt(9))) {
                    var lastChar = this.value.charAt(this.value.length - 1);
                    if (e.key.length === 1) {
                        //filtering out a & c because on ctrl+a // ctrl+c
                        //last charcter in the string should not get deleted
                        if ((e.key === 'a' && this.value.charAt(this.value.length - 1) !== 'a') ||
                            (e.key === 'c' && this.value.charAt(this.value.length - 1) !== 'c')) {
                            e.preventDefault();
                        } else {
                            this.value = this.value.substring(0, this.value.length - 1);
                        }
                    } else if (e.which === 16 && invalidcharacters.test(lastChar)) {
                        this.value = this.value.substring(0, this.value.length - 1);
                    }
                }
            } else if ((this.value.length === 2 || this.value.length === 5) && e.which !== 8) {
                this.value += '/';
            } else if ((this.value.length === 2 || this.value.length === 5) && e.which === 8) {
                this.value = this.value.substring(0, this.value.length - 1);
            }
        }
    });
}

function baseFormatPhone(targetClass) {
    //Remove dashes on focus and add dashes on blur
    //Using native JS here b/c there is some conflict with AEM events and jquery, causing the updated field value to be overwritten
    var phone_number = document.querySelector('.' + targetClass + ' input');
    phone_number.addEventListener("focus", function (e) {
        this.value = this.value.replace(/-/g, '');
    });
    phone_number.addEventListener("focusout", function (e) {
        this.value = this.value.replace(/\D/, '').replace(/(\d{3})\-?(\d{3})\-?(\d{4})/, '$1-$2-$3');
    });
    phone_number.addEventListener("input", function (e) {
        this.value = this.value.replace(/[^\d]/g, '');
    });
}

/** baseFormatPhoneOnCopy
 * @name baseFormatPhoneOnCopy
 * @param {object} phone
 * @param {scope} globals
 */
function baseFormatPhoneOnCopy(phone, globals) {
    guideBridge.connect(function () {
        guideBridge.on("elementValueChanged", function (event) {
            if (phone.$id === event.detail.fieldId) {
                const element = document.getElementById(event.detail.fieldId + '-widget');
                setTimeout(function () {
                    element.value = event.detail.currentValue.replace(/\D/, '').replace(/(\d{3})\-?(\d{3})\-?(\d{4})/, '$1-$2-$3');
                }, 10);
            }
        });
    });
}

/**
* @name baseRestrictIntlPhoneValidation
* @param {object} field 
* @param {scope} globals 
*/
function baseRestrictIntlPhoneValidation(field, globals) { 
    const phoneValue = field.$value || "";
	const currentValue =  phoneValue.replace(/[^\d+\-()\s]/g, '');
    if (phoneValue !== currentValue) {
        globals.functions.setProperty(field, { "value": currentValue });
    }
    return currentValue;
}

/**
* baseIntlPhoneValidation
* @name baseIntlPhoneValidation
* @param {string} phoneString
* @return {Boolean}
*/
function baseIntlPhoneValidation(phoneString) {
    const phoneNumberExp =/^[0-9+\- \(\)]{7,30}$/;
    return (phoneNumberExp.test(phoneString) ? true : false);
}

/**
 * @name restrictNumberOfDigits
 * @param {String} targetClass
 * @param {number} numberOfDigits
 * @param {scope} globals
 */
function restrictNumberOfDigits(targetClass, numberOfDigits, globals) {
    $(document).ready(function () {
        var numeric_field = document.querySelector('.' + targetClass + ' input');
        numeric_field.addEventListener("keydown", function (e) {
            let value = this.value;
            if (value.length > numberOfDigits) {
                this.value = value.slice(0, numberOfDigits);
            }
        });
    });
}

/**
 * baseDetectDeviceType
 * @name baseDetectDeviceType
 * @returns {string}
 */
function baseDetectDeviceType() {
    let type = 'originNameWeb';
    if (navigator.appVersion.match(/(iPhone)|(android)|(webOS)/i)) {
        type = 'originNameMobile';
    } else if (navigator.appVersion.match(/(iPad)|(iPod)|(android)|(webOS)/i)) {
        type = 'originNameTablet';
    }
    return type;
}

/**
 * Method to read campaigntracking  properties from pageinfo obj
 * @name baseReadCampaignTrackingId
 * @param {string} key
 * @returns {string}
 */
function baseReadCampaignTrackingId(key) {
    if (typeof window.parent.AbbViePageInfo.campaignTracking !== 'undefined') {
        var campaignTrackingObj = window.parent.AbbViePageInfo.campaignTracking;
        Object.keys(campaignTrackingObj).forEach(function (prop) {
            if (prop == key) {
                return campaignTrackingObj[key];
            }
        });
    } else {
        console.log("campaignTracking is undefined");
    }
}

/**
 * Download the Document of Record PDF generated from the backend service
 * @name downloadDoR
 * @param {string} fileName the name of the downloaded file
 * @param {object} button the button object that triggers the download, used for analytics
 * @param {scope} globals
 */
function downloadDoR(fileName, button, globals) {
    const lang = globals.form.$lang;
    const query = new URLSearchParams({locale: lang}).toString();

    let dorApiUrl = '/adobe/forms/af/dor/' + globals.form.$id + '?' + query;
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('wcmmode')) {
        dorApiUrl = '/abbviecloud' + dorApiUrl;
    }

    const formData = new FormData();

    const jsonString = JSON.stringify(globals.functions.exportData());
    formData.append('data', jsonString);

    let xhr = new XMLHttpRequest();
    xhr.open('POST', dorApiUrl, true);
    xhr.responseType = "arraybuffer";

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                // Create a Blob from the binary response
                const blob = new Blob([xhr.response], {type: 'application/pdf'});

                // Generate a URL for the Blob
                const blobUrl = URL.createObjectURL(blob);

                // Create an anchor element for downloading the file
                const a = document.createElement('a');
                a.href = blobUrl;

                // Set the download attribute with a default file name
                a.download = fileName ? fileName : 'DocumentOfRecord.pdf';

                // Trigger the download
                document.body.appendChild(a);
                a.click();

                // Cleanup
                URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
            } else {
                console.error("Error while generating pdf");

            }
        }
    };
    xhr.send(formData);
    admp_analytics_functions.analyticsFormInteractionEvent(button);
}

function preprocessSubmitDataForRepeatableArray(repeatable, controllerPatient, controllerProspect, globals) {
    function convertToMap(arr) {
        var map = {};
        for (var i = 0; i < arr.length; i++) {
            map[arr[i].$name] = arr[i];
        }
        return map;
    }

    function getActualKey(keyWithQualifier, keySet) {
        for (var key of keySet) {
            if (keyWithQualifier.includes(key)) {
                return key;
            }
        }
    }

    function getValueByPath(json, path) {
        var keys = path.replace(/^\$\./, '').split('.');
        return keys.reduce(function (acc, key) {
            return acc && acc[key] !== undefined ? acc[key] : undefined;
        }, json);
    }

    function updateData(controller, formData, repeatableDataRef) {
        var arrayToBeSubmitted = getValueByPath(formData, repeatableDataRef);
        var actualKeys = Object.keys(arrayToBeSubmitted[0]);
        arrayToBeSubmitted.length = 0;
        var idx = 0;
        for (var item of controller.$items) {
            var controllerValue = item.$value;
            var arrayObj = {};
            for (var keyWithQualifier in controllerValue) {
                var key = getActualKey(keyWithQualifier, actualKeys);
                var includeInArray = true;
                if (key) {
                    if (typeof controllerValue[keyWithQualifier] === 'undefined') {
                        if (key == 'ResponseId') {
                            includeInArray = false;
                            break;
                        }
                        arrayObj[key] = null;
                    } else {
                        arrayObj[key] = controllerValue[keyWithQualifier];
                    }

                } else {
                    throw new Error("key error " + keyWithQualifier);
                }
            }
            if (includeInArray) {
                arrayToBeSubmitted.push(arrayObj);
            }
        }
    }

    var formData = globals.functions.exportData();
    var repeatableDataRef = repeatable.$dataRef;
    var formRegistrationType = formData.formRegistrationType;
    if (formRegistrationType === 'Registration') {
        updateData(controllerPatient, formData, repeatableDataRef);
    } else if (formRegistrationType === 'DSARegistration') {
        updateData(controllerProspect, formData, repeatableDataRef);
    } else {
        console.log('Patient Prospect Not Selected!');
    }
    globals.functions.importData(formData);
}

/**
 * handleSubmission
 * @name handleSubmission
 * @param {Object} formRegistrationType
 * @param {Object} repeatableCampaign The instance that is repeatable and will be sent on submissions
 * @param {Object} campaignControllerPatient The panel that comes from Patient Fragment and controls the data for the repeatable if user selects Patient
 * @param {Object} campaignControlerProspect The panel that comes from Prospect Fragment and controls the data for the repeatable
 * @param {Object} repeatablePhone The instance that is repeatable and will be sent on submissions
 * @param {Object} phoneControllerPatient The panel that comes from Patient Fragment and controls the data for the repeatable if user selects Patient
 * @param {Object} phoneControlerProspect The panel that comes from Prospect Fragment and controls the data for the repeatable
 * @param {scope} globals
 */
function handleSubmission(repeatableCampaign, campaignControllerPatient, campaignControlerProspect, repeatablePhone, phoneControllerPatient, phoneControlerProspect, globals) {
    preprocessSubmitDataForRepeatableArray(repeatableCampaign, campaignControllerPatient, campaignControlerProspect, globals);
    preprocessSubmitDataForRepeatableArray(repeatablePhone, phoneControllerPatient, phoneControlerProspect, globals);

    function getValueByPath(json, path) {
        var keys = path.replace(/^\$\./, '').split('.');
        return keys.reduce(function (acc, key) {
            return acc && acc[key] !== undefined ? acc[key] : undefined;
        }, json);
    }

    function updateNulls(formData, dataRef) {
        var arr = getValueByPath(formData, dataRef);
        for (var obj of arr) {
            for (var k in obj) {
                if (typeof obj[k] === 'undefined') {
                    obj[k] = null;
                }
            }
        }
    }

    var formData = globals.functions.exportData();

    updateNulls(formData, repeatableCampaign.$dataRef);
    updateNulls(formData, repeatablePhone.$dataRef);
    fetchObservabilityAndSubmit(globals, formData)
}

/**
 * onDualSubmitSuccess
 * @name onDualSubmitSuccess
 * @param {string} registrationTyUrl
 * @param {string} dsaRegistrationTyUrl
 * @param {object} savingsCardIdTextbox
 * @param {object} InsuranceCoverageType
 * @param {object} genericErrorContainer
 * @param {scope} globals
 */
function onDualSubmitSuccess(registrationTyUrl, dsaRegistrationTyUrl, savingsCardIdTextbox, InsuranceCoverageType, genericErrorContainer, globals) {
    var formData = globals.functions.exportData();
    var formRegistrationType = formData.formRegistrationType;
    var onPremServletResponse = JSON.parse(globals.event.payload.body.metadata.data);

    var apiResponse = onPremServletResponse.apiResponse;
    var apiResponseJson = JSON.parse(apiResponse);
    var registrationResponse = apiResponseJson.RegistrationResponse;
    if (registrationResponse) {
        var IsStatusSuccessful = registrationResponse.IsStatusSuccessful;
        if (IsStatusSuccessful === "true") {
            localStorage.setItem("apiResponse", onPremServletResponse.apiResponse);
            localStorage.setItem("savingsCard_ID", savingsCardIdTextbox.$value);
            localStorage.setItem('admp_cci', JSON.stringify(registrationResponse.coPay));

            localStorage.setItem("formData", JSON.stringify(formData));
            if (formRegistrationType === "Registration") {
                window.location.href = registrationTyUrl + '?insuType=' + InsuranceCoverageType.$value;
            } else {
                window.location.href = dsaRegistrationTyUrl;
            }
            console.log(onPremServletResponse);
        } else {
            let errorArray = registrationResponse.ErrorResponseMessageList;
            var errorCodes = errorArray.map(function (error) {
                return error.ErrorCode;
            });

            handleError(errorCodes, globals, genericErrorContainer);
        }
    }
}

/**
 * showThankYouPage
 * @name showThankYouPage
 * @param {object} CardPresentPanel
 * @param {object} CardMissingPanel
 * @param {object} DefaultSuccessPanel
 * @param {object} savingsCardActivationPanel
 * @param {object} cardThankYouText
 * @param {object} rxBIN
 * @param {object} rxPCN
 * @param {object} rxGroup
 * @param {object} rxIdentifier
 * @param {scope} globals
 */
function showThankYouPage(CardPresentPanel, CardMissingPanel, DefaultSuccessPanel, savingsCardActivationPanel, cardThankYouText, rxBIN, rxPCN, rxGroup, rxIdentifier, globals) {
    var insType = "";
    if (getQueryVariable("insuType") != "false") {
        insType = getQueryVariable("insuType");
    }
    if (insType == "15") {
        if (localStorage.getItem('savingsCard_ID') !== null && localStorage.getItem('savingsCard_ID') !== '') {

            globals.functions.setProperty(CardPresentPanel, {visible: false});
            globals.functions.setProperty(CardMissingPanel, {visible: false});
            globals.functions.setProperty(DefaultSuccessPanel, {visible: false});
            globals.functions.setProperty(savingsCardActivationPanel, {visible: true});
        } else if (localStorage.getItem('admp_cci')) {
            var copayDetails = JSON.parse(localStorage.getItem('admp_cci'));
            if (copayDetails.rxBIN) {
                globals.functions.setProperty(rxBIN, {'value': copayDetails.rxBIN});
            }
            if (copayDetails.rxPCN) {
                globals.functions.setProperty(rxPCN, {'value': copayDetails.rxPCN});
            }
            if (copayDetails.rxGroup) {
                globals.functions.setProperty(rxGroup, {'value': copayDetails.rxGroup});
            }
            if (copayDetails.rxIdentifier) {
                globals.functions.setProperty(rxIdentifier, {'value': copayDetails.rxIdentifier});
            }
            globals.functions.setProperty(CardPresentPanel, {visible: true});
            globals.functions.setProperty(CardMissingPanel, {visible: false});
            globals.functions.setProperty(DefaultSuccessPanel, {visible: false});
            globals.functions.setProperty(savingsCardActivationPanel, {visible: false});
            var copaycardDetails = "<div class='qul-saving-card-info'><p>" + copayDetails.rxBIN + "</p><p>" + copayDetails.rxPCN + "</p><p>" + copayDetails.rxGroup + "</p><p>" + copayDetails.rxIdentifier + "</p></div>";
            /* if ($(".qul-saving-card-info").length) {
                $(".qul-saving-card-info").remove();
            } */
            //$(".qul-saving-card").html(copaycardDetails);
            globals.functions.setProperty(cardThankYouText, {value: copaycardDetails});
        } else {
            globals.functions.setProperty(CardPresentPanel, {visible: false});
            globals.functions.setProperty(CardMissingPanel, {visible: true});
            globals.functions.setProperty(DefaultSuccessPanel, {visible: false});
            globals.functions.setProperty(savingsCardActivationPanel, {visible: false});

        }
    } else {
        globals.functions.setProperty(CardPresentPanel, {visible: false});
        globals.functions.setProperty(CardMissingPanel, {visible: false});
        globals.functions.setProperty(DefaultSuccessPanel, {visible: true});
        globals.functions.setProperty(savingsCardActivationPanel, {visible: false});
    }

}

/**
 * getQueryVariable
 * @name getQueryVariable
 * @param {string} variable
 * @returns {string}
 */
function getQueryVariable(variable) {
    var url = window.parent.location.href;
    if (url.indexOf(variable) > -1) {
        var urlSplit = url.split("?");
        var vars = [];
        if (urlSplit.length > 1) {
            if (urlSplit[1].indexOf("&") > -1) {
                vars = urlSplit[1].split("&");
                for (var i = 0; i < vars.length; i++) {
                    var pair = vars[i].split("=");
                    if (pair[0] == variable) {
                        return pair[1];
                    }
                }
            } else {
                vars = urlSplit[1];
                var urlPair = vars.split("=");
                if (urlPair[0] == variable) {
                    return urlPair[1];
                }
            }
        }
    }
    return "false";
}

/**
 * generateUUID
 * @name generateUUID
 * @returns {string} - Returns a UUID string
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Method is used fetch a param from the base URL.
 * @param param - The name of the parameter to fetch from the URL.
 * @returns {string} - The value of the parameter, or an empty string if not found.
 */
function baseUrlGetParam(param) {
    var results = new RegExp('[\?&]' + param + '=([^&#]*)').exec(window.parent.location.href);
    return results !== null ? results[1].replaceAll('%20', ' ') : '';
}

/**
 * Method is used fetch a param from the base URL or return a default value if not found.
 * @param param - The name of the parameter to fetch from the URL.
 * @param defaultValue {string} - The default value to return if the parameter is not found.
 * @param {scope} globals - The globals scope object.
 * @returns {string} - The value of the parameter, or defaultValue, or an empty string if not found.
 */
function baseUrlGetParamOrSetDefault(param, defaultValue, globals) {
    var results = new RegExp('[\?&]' + param + '=([^&#]*)').exec(window.parent.location.href);
    if (results === null && defaultValue) {
        return defaultValue;
    } else {
        return results !== null ? results[1].replaceAll('%20', ' ') : '';
    }
}

/**
 * validatePanelAndShowNext
 * @name validatePanelAndShowNext
 * @description Validates the current panel and shows the next panel if validation passes.
 * @param {object} panel
 * @param {object} nextPanel
 * @param {scope} globals
 */
function validatePanelAndShowNext(panel, nextPanel, globals) {
    const validationResult = globals.functions.validate(panel);
    if (validationResult.length === 0) {
        globals.functions.setProperty(panel, {visible: false});
        globals.functions.setProperty(nextPanel, {visible: true});
    } else {
        panel.$items.forEach(item => {
            if (item.$id === validationResult[0].fieldName) {
                globals.functions.setProperty(item, {valid: false});
                globals.functions.setFocus(item);
            }
        });
    }
}

/**
 * validatePanel
 * @name validatePanel
 * @description Validates a panel and returns a boolean indicating whether the validation was successful.
 * @param {object} panel
 * @param {scope} globals
 * @returns {boolean}
 */
function validatePanel(panel, globals) {
    const validationResult = globals.functions.validate(panel);
    if (validationResult.length === 0) {
        return true;
    } else {
        panel.$items.forEach(item => {
            if (item.$id === validationResult[0].fieldName) {
                globals.functions.setProperty(item, {valid: false});
                globals.functions.setFocus(item);
            }
        });
        return false;
    }
}

/**
 * @name initLoader
 * @param {string} [text] Label rendered above the loader dots. Defaults to "LOADING".
 * @description Initializes the loader by removing any existing loader and adding a new one to the body.
 */
function initLoader(text) {
    $('.cmp-load-div').remove();
    var label = (typeof text === 'string' && text !== '') ? text : '';
    var loaderMarkup = '<div class="cmp-load-div"><span class="cmp-load-text">' + label + '</span><span>&#8226;</span><span>&#8226;</span><span>&#8226;</span><span>&#8226;</span></div>';
    if ($('.forms-embed').length > 0) {
        $('.forms-embed').prepend(loaderMarkup);
    } else {
        $('body').prepend(loaderMarkup);
    }
}

/**
 * @name showLoader
 * @param {boolean} show
 * @param {string} [text] Optional label (e.g. "Loading" or "Submitting"); defaults to "LOADING" for legacy callers.
 * @description Adds a class to the body to show a loading indicator.
 */
function showLoader(show, text) {
    if (show) {
        if ($('.cmp-load-div').length === 0) {
            initLoader(text);
        } else if (typeof text === 'string' && text !== '') {
            $('.cmp-load-div .cmp-load-text').text(text);
        }
        $('.forms-embed').addClass('show');
    } else {
        $('.forms-embed').removeClass('show');
    }
}

/**
 * @name hideLoader
 * @description Removes the class from the body to hide the loading indicator.
 */
function hideLoader() {
    $('.forms-embed').removeClass('show');
}

/**
 * validateDsaRegCheckbox
 * @name validateDsaRegCheckbox
 * @description Validates a panel and returns a boolean indicating whether the validation was successful.
 * @param {object} checkboxGroupPanel
 */
function validateDsaRegCheckbox(checkboxGroupPanel) {
    var checkboxGroup = $('#' + checkboxGroupPanel.$id);
    if (checkboxGroup.length > 0) {
        $.each(checkboxGroup, function (index, item) {
            if (($(item).find("input:checked").length < 1) && ($(item).is(":visible"))) {
                $(item).removeClass('validation-success').addClass('validation-failure');
                $(item).find('.errormessage').show();
            } else {
                $(item).removeClass('validation-failure').addClass('validation-success');
                $(item).find('.errormessage').hide();
            }
        });
    }
}

/**
 * validateDsaRegCheckboxGroupNoReturn
 * @name validateDsaRegCheckboxGroupNoReturn
 * @description Validates a panel with multiple single checkboxes and returns a boolean indicating whether the validation was successful.
 * @param {object} checkboxGroupPanel
 * @param {object} errorMessageObject
 * @param {scope} globals
 */
function validateDsaRegCheckboxGroupNoReturn(checkboxGroupPanel, errorMessageObject, globals) {
    var checkboxGroup = $('#' + checkboxGroupPanel.$id);
    if (checkboxGroup.length > 0) {
        $.each(checkboxGroup, function (index, item) {
            if (($(item).find("input:checked").length < 1) && ($(item).is(":visible"))) {
                $(item).removeClass('validation-success').addClass('validation-failure');
                var errorMessage = $(item).find('.errormessage');
                if (errorMessage.length > 0) {
                    errorMessage.removeClass('cmp-adaptiveform-text').show();
                    globals.functions.setProperty(errorMessageObject, {visible: true});
                }
            } else {
                $(item).removeClass('validation-failure').addClass('validation-success');
                $(item).find('.errormessage').hide();
                globals.functions.setProperty(errorMessageObject, {visible: false});
            }
        });
    }
}

/**
 * validateDsaRegCheckboxGroup
 * @name validateDsaRegCheckboxGroup
 * @description Validates a panel with multiple single checkboxes and returns a boolean indicating whether the validation was successful.
 * @param {object} checkboxGroupPanel
 * @param {object} errorMessageObject
 * @param {scope} globals
 * @returns {boolean} - Returns true if validation fails, false otherwise.
 */
function validateDsaRegCheckboxGroup(checkboxGroupPanel, errorMessageObject, globals) {
    var checkboxGroup = $('#' + checkboxGroupPanel.$id);
    var validationFailed = false;
    if (checkboxGroup.length > 0) {
        $.each(checkboxGroup, function (index, item) {
            if (($(item).find("input:checked").length < 1) && ($(item).is(":visible"))) {
                $(item).removeClass('validation-success').addClass('validation-failure');
                var errorMessage = $(item).find('.errormessage');
                if (errorMessage.length > 0) {
                    errorMessage.removeClass('cmp-adaptiveform-text').show();
                    globals.functions.setProperty(errorMessageObject, {visible: true});
                }
                validationFailed = true;
            } else {
                $(item).removeClass('validation-failure').addClass('validation-success');
                $(item).find('.errormessage').hide();
                globals.functions.setProperty(errorMessageObject, {visible: false});
            }
        });
    }
    return validationFailed;
}

/**
 * validateAllDsaRegCheckbox
 * @name validateAllDsaRegCheckbox
 * @description Validates a panel and returns a boolean indicating whether the validation was successful.
 */
function validateAllDsaRegCheckbox() {
    var checkboxGroup = $('.campaign-question-checkboxgroup');
    if (checkboxGroup.length > 0) {
        $.each(checkboxGroup, function (index, item) {
            if (($(item).find("input:checked").length < 1) && ($(item).is(":visible"))) {
                $(item).removeClass('validation-success').addClass('validation-failure');
                $(item).find('.errormessage').show();
                var errorPanelItem = $(item).offset().top;
                var iframeTop = $(window.parent.document).find('.cmp-adaptiveform-container').offset().top;
                $('html, body', window.parent.document).animate({scrollTop: (errorPanelItem + iframeTop)}, 350);
            } else {
                $(item).removeClass('validation-failure').addClass('validation-success');
                $(item).find('.errormessage').hide();
            }
        });
    }
}

/**
 * baseCreateJsonArrayForSurveyPayload
 * @name baseCreateJsonArrayForSurveyPayload
 * @param {object} survey
 * @param {scope} globals
 * @description This function is a placeholder for creating a JSON array for survey payload.
 */
function baseCreateJsonArrayForSurveyPayload(survey, globals) {
    let jsonData = globals.functions.exportData();
    const panelElementName = survey.$name;
    let count = 0;
    let answerCount = 0;
    let surveyObject = {};
    var tempAnswers = {};
    for (var item in jsonData) {
        if (item.includes(panelElementName)) {
            var surveyAssessmentNo = item.split("_")[1];
            var answerAssessmentNO = item.split("_")[3];
            var surveyName = panelElementName + "_" + surveyAssessmentNo;
            var questionId = surveyName + "_questionid";
            var question = surveyName + "_question";
            var answerName = surveyName + "_answer_" + answerAssessmentNO;
            var anwserId = answerName + "_id";
            var anwserValue = answerName + "_value";
            if (jsonData[questionId] && jsonData[question]) {

                if (item === questionId) {
                    surveyObject.questionId = jsonData[questionId];
                }
                if (item === question) {
                    surveyObject.question = jsonData[question];
                    count++;
                }
            }

            if (jsonData[anwserId] && jsonData[anwserValue]) {
                if (!('answer' in surveyObject)) {
                    surveyObject.answer = [];
                }

                var surveyCount = count - 1;
                if (item === anwserId) {
                    tempAnswers.ID = jsonData[anwserId];
                }
                if (item === anwserValue) {
                    answerCount++;
                    tempAnswers.value = jsonData[anwserValue];
                    surveyObject.answer.push(tempAnswers);
                    tempAnswers = {};
                }
            }
        }
    }
    jsonData.HcpCaptureRequest.survey = [surveyObject];
    globals.functions.importData(jsonData);
}

function showGuideLoading(show) {
    if (show) {
        $('.data-cmp-adaptiveform-container-loader').add('cmp-adaptiveform-container--loading');
        window.document.body.classList.add("af-freezeBody");
    } else {
        $('.data-cmp-adaptiveform-container-loader').attr("class", "");
        window.document.body.classList.remove("af-freezeBody");
    }
}

function removeAllMessages() {
    $('.data-cmp-adaptiveform-container-loader').empty().removeClass("guideMessage");
    return this;
}

/**
 * baseURLRedirection
 *
 * @name baseURLRedirection
 * @param url redirection url
 * @param globals global scope
 * @description This function checks if the provided URL is valid for redirection.
 */
function baseURLRedirection(url, globals) {
    var pattern = /^((http|https):\/\/)/;
    var isValidUrl = !pattern.test(url);
    var errorMsgList = {
        ErrorResponseMessageList: []
    };
    errorMsgList.ErrorResponseMessageList[0] = "Something went wrong. Please try again later.";
    if (!isValidUrl) {
        console.log("Not a valid redirect url. The redirect url has https/http prefixed.");
        baseHandleErrorResponse(errorMsgList, globals);
    } else {
        window.parent.location = url;
    }
}

/**
 * triggerAnalyticsEventOnButton
 *
 * @name triggerAnalyticsEventOnButton
 * @param {Object} button
 */
function triggerAnalyticsEventOnButton(button) {
    admp_analytics_functions.analyticsFormInteractionEvent(button);
}

function baseSubmitReset() {
    showGuideLoading(false);
    removeAllMessages();
}

/**
 * openModalOnClick
 * @name openModalOnClick
 */
function openModalOnClick() {
    $(document).on('click', '.npi-registory', function (e) {
        e.preventDefault();
        window.parent.abbvModal.openModal(this);
    });
}

/**
 * openModalOnCssClassClicked
 * @name openModalOnCssClassClicked
 * @param {string} cssClass CSS class of the element to bind the click event to.
 */
function openModalOnCssClassClicked(cssClass) {
    $(document).on('click', cssClass, function (e) {
        e.preventDefault();
        window.parent.abbvModal.openModal(this);
    });
}

/**
 * setVisitedColorOnCssClassClicked
 * @name setVisitedColorOnCssClassClicked
 * @param {string} cssClass CSS class of the element to bind the click event to.
 * @param {string} color The color to set when the element is clicked. Default is '#551a8b'.
 */
function setVisitedColorOnCssClassClicked(cssClass, color = '#551a8b') {
    const attachHandler = (link) => {
        if (!link.__colorHandlerAttached) {
            link.__colorHandlerAttached = true;

            link.addEventListener("click", function (event) {
                // Prevent page navigation but allow JS handlers
                if (link.getAttribute("href") === "#") {
                    event.preventDefault();
                }
                // --- Always toggle inline color ---
                if (this.style.color === color) {
                    this.style.color = "";
                } else {
                    this.style.color = color;
                }

                // --- Now run modal logic (ensures color first) ---
                if (typeof modalFn === "function") {
                    // Slight timeout guarantees browser repaints color first
                    setTimeout(() => modalFn(link), 50);
                }
            });

            console.log(`✔ Handler attached `);
        }
    };

    // --- Try to find immediately ---
    const existing = document.querySelector("a." + cssClass);
    if (existing) {
        attachHandler(existing);
    }

    // --- Observe for dynamic insertion ---
    const observer = new MutationObserver(() => {
        const el = document.querySelector("a." + cssClass);
        if (el) {
            attachHandler(el);
        }
    });

    observer.observe(document.body, {childList: true, subtree: true});

}

/**
 * scrollToTarget
 * @name scrollToTarget
 * @param {string} targetClasses CSS class or CSS classes of the target element to scroll to. (for example: '.target-class.another-target-class')
 * @param {number} offset - The offset in pixels to adjust the scroll position.
 */
function scrollToTarget(targetClasses, offset) {
    const $target = $(targetClasses).first();
    $target.attr('tabindex', -1).focus();
    $('html, body').scrollTop($target.offset().top + offset);
}

/**
 * baseUpdateRegistrationForms
 * @name baseUpdateRegistrationForms
 * @param {string} formRegistrationType The type of registration form to display ("Registration" or "DSARegistration").
 * @param {object} patientReg patient registration fragment object.
 * @param {object} dSAreg dsa registration fragment object.
 * @param {scope} globals The global scope object.
 */
function baseUpdateRegistrationForms(formRegistrationType, patientReg, dSAreg, globals) {
    if (patientReg && dSAreg) {
        if (formRegistrationType === "Registration") {
            globals.functions.setProperty(patientReg, {visible: true});
            globals.functions.setProperty(dSAreg, {visible: false});
            globals.functions.reset(dSAreg);
            admp_analytics_functions.updateRegistrationFormsAnalytics(patientReg);
        } else if (formRegistrationType === "DSARegistration") {
            globals.functions.setProperty(patientReg, {visible: false});
            globals.functions.reset(patientReg, {visible: false});
            globals.functions.setProperty(dSAreg, {visible: true});
            admp_analytics_functions.updateRegistrationFormsAnalytics(dSAreg);
        }
    }
}

/**
 * initSavingsCardThankYouForm
 * @name initSavingsCardThankYouForm
 * @param {scope} globals
 */
function initSavingsCardThankYouForm(globals) {
    var coPayCardDetails = JSON.parse(localStorage.getItem("admp_cci"));
    if (coPayCardDetails) {
        const card = globals.form.savingsCardPanel['saving-card-number-panel'].savingsCardNumber;
        globals.functions.setProperty(card, {value: coPayCardDetails.rxIdentifier});
    } else {
        if (globals.form.redirectUrl.value) {
            window.parent.location = globals.form.redirectUrl.value;
        }
    }
}

/**
 * downloadSavingsCard
 * @name downloadSavingsCard
 * @param {scope} globals
 */
function downloadSavingsCard(globals) {

    document.addEventListener("AF_FormContainerInitialised", function (event) {
        $("#savingscard-download").on('click', function (e) {
            e.preventDefault();
            const coPayCardDetails = JSON.parse(localStorage.getItem("admp_cci"));
            generatePDFSaving('PDF', coPayCardDetails, 'savingscard');
        });
    });
}

/**
 * Download Savings Card on Click
 * @name downloadSavingsCardOnClick
 * @param {scope} globals
 */
function downloadSavingsCardOnClick(globals) {
    console.log("inside form js :fn generatePdf called");
    const coPayCardDetails = JSON.parse(localStorage.getItem("admp_cci"));
    generatePDFSaving('PDF', coPayCardDetails, 'savingscard');
}

function generatePDFSaving(serviceType, coPayCardDetails, pdfName) {
    const cardDetails = {
        "RxIdentifier": coPayCardDetails.rxIdentifier,
        "RxGroup": coPayCardDetails.rxGroup,
        "RxBIN": coPayCardDetails.rxBIN,
        "RxPCN": coPayCardDetails.rxPCN,
        "Suf": coPayCardDetails.suf || '01'
    };
    console.log("inside form js :fn generatePDFSaving called");
    var currentPageUrl = window.AbbViePageInfo.pagepath;
    var payload = {
        firstname: 'firstName',
        service: serviceType,
        cardDetails: cardDetails,
        pagePath: currentPageUrl
    };
    if (pdfName === "savingscard") {
        //payload.indicationId = indicationId;
        payload.finalIndicationPath = "test";
        payload.globalISIPath = "test";
    }
    var serviceURI = "/bin/abbvieforms/abbviepdf";
    var form = document.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action', serviceURI);
    var hiddenField = document.createElement('input');
    hiddenField.setAttribute('type', 'hidden');
    hiddenField.setAttribute('name', 'data');
    hiddenField.setAttribute('value', JSON.stringify(payload));
    form.appendChild(hiddenField);
    document.body.appendChild(form);
    form.submit();
}

/**
 * Set Cookie
 * @name setCookie
 * @param {string} cname
 * @param {string} cvalue
 * @param {boolean} cookieSecureFlag
 * @param {number} ttl in seconds
 */
function setCookie(cname, cvalue, cookieSecureFlag, ttl) {
    var d = new Date();
    d.setTime(d.getTime() + ttl * 1000);
    var expires = "expires=" + d.toGMTString();
    var cookieString = cname + "=" + cvalue;

    if (cookieSecureFlag == true) {
        document.cookie = cookieString + ";max-age=" + ttl + ";" + expires + ";Path=/;secure";
    } else {
        document.cookie = cookieString + ";max-age=" + ttl + ";" + expires + ";Path=/";
    }
}

/**
 * Delete Cookie
 * @name deleteCookie
 * @param cookieString
 */
function deleteCookie(cookieString) {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var expires = "expires=" + d.toGMTString();
    document.cookie = cookieString + "=;" + expires + ";Path=/";
}

/**
 * Read and retrieve cookie
 * @name baseGetCookieValue
 *
 * @param {String} name - name of the cookie
 **/
function baseGetCookieValue(name) {
    var cookieMatch = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
}

/**
 * Read and retrieve cookie from parent page
 * @name baseGetParentPageCookieValue
 *
 * @param {String} name - name of the cookie
 **/
function baseGetParentPageCookieValue(name) {
    return window.parent.cookieObj.getCookie(name);
}

/**
 * Reload Page
 * @name baseReloadPage
 */
function baseReloadPage() {
    window.parent.location.reload();
}

/**
 * setFieldValueBasedonURLParam
 * @name setFieldValueBasedonURLParam
 * @param {string} param
 * @param {string} [defaultVal] default value to be set,optional
 * @param {object} field
 * @param {scope} globals
 */

function setFieldValueBasedonURLParam(param, defaultVal, field, globals) {
    var paramVal = baseUrlGetParamOrSetDefault(param, defaultVal, globals);
    if (paramVal) {
        globals.functions.setProperty(field, {'value': paramVal});
    }
}

/**
 * openPopUpModal
 * @name openPopUpModal
 * @param {string} cssClassName
 */

function openPopUpModal(cssClassName) {
    window.parent.abbvModal.openModal('.' + cssClassName);
}

/**
 * openPopUpModalWithTwoParameter
 * abbvModal.openModal will be called with two parameters, can be used on a button click
 * @name openPopUpModalWithTwoParameter
 * @param {string} firstParameter
 * @param {string} secondParameter
 */

function openPopUpModalWithTwoParameter(firstParameter, secondParameter) {
    window.parent.abbvModal.openModal(firstParameter, secondParameter);
}

/**
 * onModalOpenClearFieldValue
 * @name onModalOpenClearFieldValue
 * @param {string} cssClassName
 * @param {object} field
 * @param {scope} globals
 */
function onModalOpenClearFieldValue(cssClassName, field, globals) {
    window.parent.$('.' + cssClassName).on('click', function () {
        globals.functions.reset(field);
    });
}

/**
 * Set Cookie and Reload Page for Humira Signup Form
 * @name setCookieAndReloadPageHumiraSignupForm
 * @param {object} indicationDropdown
 * @param {String} cookieValueToSet
 * @param {object} analyticsMetadataPanel
 * @param {scope} globals
 */
function setCookieAndReloadPageHumiraSignupForm(indicationDropdown, cookieValueToSet, analyticsMetadataPanel, globals) {
    var indicationNameCookieValue = baseGetCookieValue('indicationName');
    const indicationMap = new Map();
    indicationMap.set("rheumatoid-arthritis", "1");
    indicationMap.set("psoriasis", "6");
    indicationMap.set("crohns", "2");
    indicationMap.set("ulcerative-colitis", "4");
    indicationMap.set("psoriatic-arthritis", "3");
    indicationMap.set("hidradenitis-suppurativa", "354");
    indicationMap.set("ankylosing-spondylitis", "5");
    indicationMap.set("uveitis", "587");
    indicationMap.set("pediatric-crohns", "10002");
    indicationMap.set("juvenile-arthritis", "10001");
    indicationMap.set("pediatric-ulcerative-colitis", "10666");

    if (indicationDropdown.$value && indicationDropdown.$value !== indicationMap.get(indicationNameCookieValue)) {
        setCookie('indicationName', cookieValueToSet, false, 900);

        analyticspayload.init(analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
        admp_analytics_functions.updateDigitalDataObject('#' + analyticsMetadataPanel.$id);
        // Timeout before reloading page for analytics change event to trigger
        setTimeout(function () {
            baseReloadPage();
        }, 200);
    }
}

/**
 * Get Cookie Value for Rinvoq Indication Form
 * @name getValueFromCookieToRinvoqIndicationForm
 */
function getValueFromCookieToRinvoqIndicationForm() {
    var indicationCookieValue = baseGetCookieValue('indicationName');
    if (indicationCookieValue === "pjia-jpsa") {
        indicationCookieValue = baseGetCookieValue('indicationSubName');
    }
    return indicationCookieValue;
}

/**
 * Set Cookie and Reload Page for Rinvoq Indication Form
 * @name setCookieAndReloadPageRinvoqIndicationForm
 * @param {object} indicationDropdown
 * @param {object} analyticsMetadataPanel
 * @param {scope} globals
 */
function setCookieAndReloadPageRinvoqIndicationForm(indicationDropdown, analyticsMetadataPanel, globals) {
    var indicationNameCookieValue = baseGetCookieValue('indicationName');
    var indicationSubNameCookieValue = baseGetCookieValue('indicationSubName');
    if (indicationDropdown.$value && indicationDropdown.$value !== indicationNameCookieValue && indicationDropdown.$value !== indicationSubNameCookieValue) {
        showLoader(true);
        // x-aem-variant is the cache-key cookie: the CDN promotes it to a header and the dispatcher
        // turns it into an `indication-*` selector. Join with '--', never '.', so it can't inject
        // extra selectors. Name is fixed by AEMaaCS — don't rename.
        if (indicationDropdown.$value === 'active-juvenile-psoriatic-arthritis' || indicationDropdown.$value === 'active-juvenile-polyarticular-arthritis') {
            setCookie('indicationName', 'pjia-jpsa', false, 900);
            setCookie('indicationSubName', indicationDropdown.$value, false, 900);
            setCookie('x-aem-variant', 'pjia-jpsa--' + indicationDropdown.$value, false, 900);
        } else {
            setCookie('indicationName', indicationDropdown.$value, false, 900);
            deleteCookie('indicationSubName');
            setCookie('x-aem-variant', indicationDropdown.$value, false, 900);
        }
        analyticspayload.init(analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
        admp_analytics_functions.updateDigitalDataObject('#' + analyticsMetadataPanel.$id);
        // Timeout before reloading page for analytics change event to trigger
        setTimeout(function () {
            baseReloadPage();
        }, 200);
    }
}

/** Initialize Rinvoq Indication Selection Analytics
 * @name initRinvoqIndicationSelectionAnalytics
 * @param {object} analyticsMetadataPanel
 * @param {scope} globals
 */
function initRinvoqIndicationSelectionAnalytics(analyticsMetadataPanel, globals) {
    document.addEventListener("AF_FormContainerInitialised", function (event) {
        analyticspayload.init(analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
        admp_analytics_functions.updateDigitalDataObject('#' + analyticsMetadataPanel.$id);
    });
}

/** Reload Rinvoq Indication Selection Analytics
 * @name reloadRinvoqIndicationSelectionAnalytics
 * @param {object} analyticsMetadataPanel
 * @param {object} button
 * @param {scope} globals
 */
function reloadRinvoqIndicationSelectionAnalytics(analyticsMetadataPanel, button, globals) {
    analyticspayload.init(analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
    admp_analytics_functions.updateDigitalDataObject('#' + analyticsMetadataPanel.$id);
    analyticspayload.setStepNameFromPayload(button);
    window.parent.digitalData.page.form.fieldName = button.$label.value;
    window.parent.digitalData.page.form.fieldValue = '';
    if (window.parent.digitalData.page.form.fieldValues) {
        window.parent.digitalData.page.form.fieldValues = '';
    }
    admp_analytics_functions.onFormStartEvent();
    console.log(window.parent.digitalData.page.valueOf());
}

/**
 * Reset checkbox by a specific selection
 * @name resetCheckboxGroupBySelection
 * @param {string} resetString
 * @param {object} checkboxGroup
 * @param {scope} globals
 */
function resetCheckboxGroupBySelection(resetString, checkboxGroup, globals) {
    if (!globals.event.payload) {
        return;
    }
    $('#' + globals.field.$id).removeClass('skip-payloadConsole');
    let prevValue = globals.event.payload.changes[0].prevValue;
    let currentValue = globals.event.payload.changes[0].currentValue;
    if (prevValue && prevValue.length === 1 && prevValue.includes(resetString)) {
        const index = currentValue.indexOf(resetString);
        if (index > -1) {
            currentValue.splice(index, 1);
            globals.functions.setProperty(checkboxGroup, {value: currentValue});
        }
    } else if (currentValue && currentValue.includes(resetString) && currentValue.length > 1) {
        $('#' + globals.field.$id).addClass('skip-payloadConsole');
        globals.functions.setProperty(checkboxGroup, {value: [resetString]});
    }
}

/**
 * Reset single checkbox without triggering analytics event
 * @name resetSingleCheckboxWithoutAnalytics
 * @param {object} checkbox
 * @param {scope} globals
 */
function resetSingleCheckboxWithoutAnalytics(checkbox, globals) {
    if (checkbox.$value !== null && checkbox.$value !== undefined) {
        $('#' + checkbox.$id).addClass('skip-payloadConsole');
    }
    globals.functions.reset(checkbox);
}

/** Set Optin Date
 * @name baseSetOptinDate
 * @returns {string} - Returns the current date in ISO format.
 */
function baseSetOptinDate() {
    return (new Date()).toISOString();
}

/** Custom downloadSavingsCardButtonClick.
 * @name downloadSavingsCardButtonClick
 * @param {string} buttonClassname - The class name of the button click
 * @param {scope} globals
 */
function downloadSavingsCardButtonClick(buttonClassname, globals) {
    const downloadButton = $("." + buttonClassname);
    if (downloadButton.length) {
        downloadButton.on("click", function (e) {
            e.preventDefault();
            const coPayCardDetails = JSON.parse(localStorage.getItem("admp_cci") || "{}");
            generatePDFSaving("PDF", coPayCardDetails, "savingscard");
        });
    }
}

/**
 * setCopayDetailsToTaytullaSavingsCardThankYouPage
 * This function sets the copay details to the Taytulla Savings Card Thank You Page.
 * It can be used for Taytulla Thankyou page.
 * @name setCopayDetailsToTaytullaSavingsCardThankYouPage
 */
function setCopayDetailsToTaytullaSavingsCardThankYouPage() {
    if (localStorage.getItem('admp_cci')) {
        var copayDetails = JSON.parse(localStorage.getItem('admp_cci'));
        if (copayDetails) {
            $('#rxBIN').html(copayDetails.rxBIN);
            $('#rxPCN').html(copayDetails.rxPCN);
            $('#rxGroup').html(copayDetails.rxGroup);
            $('#rxIdentifier').html(copayDetails.rxIdentifier);
        }
    }
}

/**
 * baseQRcodeInThankyouPanel
 * This function generates a QR code for the Thank You Panel.
 *
 * @name baseQRcodeInThankyouPanel
 * @param {string} qrImageClassName
 * @param {string} widthValue
 * @param {string} qrCodeURL
 * @param {scope} globals
 */
function baseQRcodeInThankyouPanel(qrImageClassName, widthValue, qrCodeURL, globals) {
    const copay = JSON.parse(localStorage.getItem('admp_cci'));
    let copayCardDetails = {};
    if (copay) {
        if (copay.ContentResult) {
            copayCardDetails = copay.ContentResult.CopayCard;
        } else {
            copayCardDetails = copay;
        }
    }
    const hostName = window.location.origin;
    const device = baseDetectDeviceType();
    let reqObj = {
        brandName: globals.event.target.$form.$properties.brandName,
        apiType: globals.event.target.$form.$properties.apiType,
        copayDetails: JSON.stringify(copayCardDetails),
        formAction: 'MobileWallet',
        fileName: 'savingscard',
        version: globals.event.target.$form.$properties.version
    };
    const finalUrl = hostName + qrCodeURL + '?requestData=' + encodeURIComponent(JSON.stringify(reqObj));
    const apiurl = '/abbviecloud/bin/abbvie/qrcode.png?string=' + encodeURIComponent(finalUrl) + '&width=' + widthValue;
    $.ajax({
        url: apiurl,
        type: 'GET',
        async: true,
        mimeType: 'text/plain; charset=x-user-defined'
    }).done(function (data) {
        if (device !== 'originNameMobile') {
            $('.' + qrImageClassName).attr('src', 'data:image/jpeg;base64,' + customBase64Encode(data));
        }
    }).fail(function (errorThrown) {
        console.log('failed: ' + errorThrown);
    });
}

/**
 * initializeLoloSavingCardActivation
 * This function initializes the Lolo Saving Card Activation Thank You Page by populating the card details, determining the user's device type, and generating a QR code for mobile wallet integration.
 * It can be used for the loloestring savings-thankyou form.
 * @name initializeLoloSavingCardActivation
 * @param {object} googleWalletText
 * @param {object} appleWalletText
 * @param {object} qrCodeWidth
 * @param {object} qrCodeUrl
 * @param {scope} globals
 */
function initializeLoloSavingCardActivation(googleWalletText, appleWalletText, qrCodeWidth, qrCodeUrl, globals) {
    if (localStorage.getItem('admp_cci')) {
        var copayDetails = JSON.parse(localStorage.getItem('admp_cci'));
        var copaycardDetails = "<div class='lolo-saving-card-info'><p>rxBIN:" + copayDetails.rxBIN + "</p><p>rxPCN:" + copayDetails.rxPCN + "</p><p>rxGroup:" + copayDetails.rxGroup + "</p><p>rxIdentifier:" + copayDetails.rxIdentifier + "</p></div>";
        if ($(".lolo-saving-card-info").length) {
            $(".lolo-saving-card-info").remove();
        }
        $(".lolo-saving-card").html(copaycardDetails);
        $('.rxbin').html("<p class='copayValue' style='font-size: 16px;font-weight: bold;color: #000;'><b  style='color: rgb(125,65,153);font-size: 16px;'>BIN#</b> <b style='font-size: 16px;font-weight: bold;color: #000;'>004682</b></p>");
        $('.rxpcn').html("<p class='copayValue' style='font-size: 16px;font-weight: bold;color: #000;'><b  style='color: rgb(125,65,153);font-size: 16px;'>PCN#</b> <b style='font-size: 16px;font-weight: bold;color: #000;'>CN</b></p>");
        $('.rxgroup').html(
            "<p class='copayValue' style='font-size: 16px;font-weight: bold;color: #000;'><b  style='color: rgb(125,65,153);font-size: 16px;'>RxGRP#</b> <b style='font-size: 16px;font-weight: bold;color: #000;'>" + copayDetails.rxGroup + "</b></p>");
        $('.rxid').html(
            "<p class='copayValue' style='font-size: 16px;font-weight: bold;color: #000;'><b  style='color: rgb(125,65,153);font-size: 16px;'>RxID#</b> <b style='font-size: 16px;font-weight: bold;color: #000;'>" + copayDetails.rxIdentifier
            + "</b></p>");

    }
    var userAgent = navigator.userAgent;
    if (/android/i.test(userAgent)) {
        globals.functions.setProperty(googleWalletText, {visible: true});
        globals.functions.setProperty(appleWalletText, {visible: false});
    } else if (/iPhone/.test(userAgent) && !userAgent.includes('Macintosh')) {
        globals.functions.setProperty(googleWalletText, {visible: false});
        globals.functions.setProperty(appleWalletText, {visible: true});
    } else {
        globals.functions.setProperty(googleWalletText, {visible: false});
        globals.functions.setProperty(appleWalletText, {visible: false});
    }
    baseQRcodeInThankyouPage('qrimage', qrCodeWidth.$value, qrCodeUrl.$value);
    $(function () {
        $('.addtowallet').on('click', function () {
            window.parent.location = this.href;
        });
    });
}

/**
 * baseQRcodeInThankyouPage
 * This function generates a QR code for the Thank You Page.
 *
 * @name baseQRcodeInThankyouPage
 * @param {string} qrImageClassName
 * @param {string} widthValue
 * @param {string} qrCodeURL
 */
function baseQRcodeInThankyouPage(qrImageClassName, widthValue, qrCodeURL) {
    document.addEventListener("AF_FormContainerInitialised", function (event) {
        const copay = JSON.parse(localStorage.getItem('admp_cci'));
        let copayCardDetails = {};
        if (copay) {
            if (copay.ContentResult) {
                copayCardDetails = copay.ContentResult.CopayCard;
            } else {
                copayCardDetails = copay;
            }
        }
        const hostName = window.location.origin;
        const device = baseDetectDeviceType();
        let reqObj = {
            brandName: event.detail._model._jsonModel.properties.brandName,
            copayDetails: JSON.stringify(copayCardDetails),
            formaction: 'MobileWallet',
            fileName: 'savingscard',
            version: event.detail._model._jsonModel.properties.version
        };
        const apiurl = '/abbviecloud/bin/abbvie/qrcode.png?string=' + hostName + qrCodeURL + '?requestData=' + JSON.stringify(reqObj) + '&width=' + widthValue;
        $.ajax({
            url: apiurl,
            type: 'GET',
            async: true,
            mimeType: 'text/plain; charset=x-user-defined'
        }).done(function (data) {
            if (device !== 'originNameMobile') {
                $('.' + qrImageClassName).attr('src', 'data:image/jpeg;base64,' + customBase64Encode(data));
            }
        }).fail(function (errorThrown) {
            console.log('failed: ' + errorThrown);
        });
    });
}

/**
 * basePrint
 * This function triggers the browser's print dialog to print the current page.
 * @name basePrint
 */
function basePrint() {
    window.print();
}

/**
 * initializeSavellaSavingsCardActivation
 * This function initializes the Savella Savings Card Thank You Form by populating the savings card number and setting up the PDF download functionality.
 * It can be used for the savella-savings-card-thank-you-form and the savella-sign-up-thank-you-form.
 * @name initializeSavellaSavingsCardActivations
 * @param {object} savingsCardNumber
 */
function initializeSavellaSavingsCardThankyouForm(savingsCardNumber) {
    const coPayCardDetails = JSON.parse(localStorage.getItem("admp_cci"));
    if (coPayCardDetails) {
        globals.functions.setProperty(savingsCardNumber, {'value': coPayCardDetails.rxIdentifier});
    }

    $(document).ready(function () {
        $("#savella-savingscard-download").on('click', function (e) {
            e.preventDefault();
            generatePDFSaving('PDF', coPayCardDetails, 'savingscard');
        });
    });
}

/**
 * Get UserAgent
 * @name getUserAgent
 * @returns {string} - Returns the user agent string of the browser.
 */
function getUserAgent() {
    return navigator.userAgent;
}

/**
 * userAgentIsAndroid
 * @name userAgentIsAndroid
 * @returns {boolean} - Returns true if the user agent indicates an Android device, false otherwise.
 */
function userAgentIsAndroid() {
    var userAgent = navigator.userAgent;
    return /android/i.test(userAgent);
}

/**
 * userAgentIsiOS
 * @name userAgentIsiOS
 * @returns {boolean} - Returns true if the user agent indicates an iOS device, false otherwise.
 */
function userAgentIsiOS() {
    var userAgent = navigator.userAgent;
    return /iPhone/.test(userAgent) && !userAgent.includes('Macintosh');
}

/**
 * initialzeUbrelvySavingsCardThankYouForm
 * @name initialzeUbrelvySavingsCardThankYouForm
 * @param {object} cardDetailsText
 * @param {object} imageQR
 * @param {scope} globals
 * This function initializes the Ubrelvy Savings Card Thank You Form by populating the savings card number and setting up the PDF download functionality.
 * It can be used for the ubrelvy-savings-card-thank-you-form.
 */
function initialzeUbrelvySavingsCardThankYouForm(cardDetailsText, imageQR, globals) {
    if (localStorage.getItem('admp_cci')) {
        var copayDetails = JSON.parse(localStorage.getItem('admp_cci'));
        let copaycardDetails = "<div class='qul-saving-card-info'><p>" + copayDetails.rxBIN + "</p><p>" + copayDetails.rxPCN + "</p><p>" + copayDetails.rxGroup + "</p><p>" + copayDetails.rxIdentifier + "</p></div>";
        globals.functions.setProperty(cardDetailsText, {value: copaycardDetails});

    }

    if (localStorage.getItem('admp_walletURLs')) {
        const walletUrls = JSON.parse(localStorage.getItem('admp_walletURLs'));
        globals.functions.setProperty(imageQR, {value: walletUrls.qrImageUrl});
        $('.wallet-btn').on('click', function () {
            window.parent.location = walletUrls.walletPassUrl;
        });
    }

    //Handle Anchor Tag Clicks out of iFrame
    $(".abbv-iframe-anchor-click").click(function () {
        window.parent.open($(this).attr("data-url"), "_self");
    });
}

/**
 * initializeUbrelvyChallengeThankYouForm
 * It can be used for the ubrelvy-savings-card-thank-you-form.
 * @name initializeUbrelvyChallengeThankYouForm
 * @param {object} cardDetailsText
 * @param {scope} globals
 */
function initializeUbrelvyChallengeThankYouForm(cardDetailsText, globals) {
    if (localStorage.getItem('admp_cci')) {
        var copayDetails = JSON.parse(localStorage.getItem('admp_cci'));
        let copaycardDetails = "<div class='ubrelvy-saving-card-info'><p class='ubrelvy-challenge-card-info'><span class='ubrelvy-bin'> BIN: </span>" + copayDetails.rxBIN
            + "</p><p class='ubrelvy-challenge-card-info'><span class='ubrelvy-pcn'> PCN #: </span>" + copayDetails.rxPCN + "</p><p class='ubrelvy-challenge-card-info'>"
            + "</p><p class='ubrelvy-challenge-card-info'><span class='ubrelvy-card-number'> Card Number </span> " + copayDetails.rxIdentifier + "</p></div>";
        globals.functions.setProperty(cardDetailsText, {value: copaycardDetails});
    }
}

function customBase64Encode(str) {
    var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '', i = 0, len = str.length, c1, c2, c3;
    while (i < len) {
        c1 = str.charCodeAt(i++) & 0xff;
        if (i == len) {
            out += CHARS.charAt(c1 >> 2);
            out += CHARS.charAt((c1 & 0x3) << 4);
            out += '==';
            break;
        }
        c2 = str.charCodeAt(i++);
        if (i == len) {
            out += CHARS.charAt(c1 >> 2);
            out += CHARS.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
            out += CHARS.charAt((c2 & 0xF) << 2);
            out += '=';
            break;
        }
        c3 = str.charCodeAt(i++);
        out += CHARS.charAt(c1 >> 2);
        out += CHARS.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
        out += CHARS.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
        out += CHARS.charAt(c3 & 0x3F);
    }
    return out;
}

/**
 * helpTextPerRadioButtonOption
 * @name helpTextPerRadioButtonOption
 * @param {scope} globals
 */
function helpTextPerRadioButtonOption(globals) {
    let $radioGroup = $('#' + globals.field.$id);
    if ($radioGroup.length) {
        let $helpIcon = $radioGroup.find('.cmp-adaptiveform-radiobutton__questionmark'),
            $helpDesc = $radioGroup.find('.cmp-adaptiveform-radiobutton__longdescription'),
            helpDescHTML = $helpDesc.html(),
            $radioBtn = $radioGroup.find('.cmp-adaptiveform-radiobutton__option'),
            helpIconWrapperHTML = '<div class="cmp-adaptiveform-radiobutton__questionmark" style="position:static"></div>',
            helpDesWrapperHTML = '<div class="cmp-adaptiveform-radiobutton__longdescription__custom long"></div>';

        $helpDesc.hide();
        helpDescHTML = helpDescHTML.split(';;');
        $helpIcon.remove();
        $radioBtn.each(function (idx, val) {
            if (helpDescHTML[idx].replace(/<[^>]*>/g, "").trim().length === 0) {
                return true;
            }
            var $this = $(this);
            $this.find('label').after(helpIconWrapperHTML);
            $this.append(helpDesWrapperHTML);
            $this.find('.cmp-adaptiveform-radiobutton__longdescription__custom').html(helpDescHTML[idx]).toggle();
            $this.find('.cmp-adaptiveform-radiobutton__questionmark').click(function (e) {
                $(this).parents('.cmp-adaptiveform-radiobutton__option').find('.cmp-adaptiveform-radiobutton__longdescription__custom').toggle();
                e.stopPropagation();
            });
        });
    }
}

/**
 * helpTextPerCheckboxGroupOption
 * @name helpTextPerCheckboxGroupOption
 * @param {scope} globals
 */
function helpTextPerCheckboxGroupOption(globals) {
    let $radioGroup = $('#' + globals.field.$id);
    if ($radioGroup.length) {
        let $helpIcon = $radioGroup.find('.cmp-adaptiveform-checkboxgroup__questionmark'),
            $helpDesc = $radioGroup.find('.cmp-adaptiveform-checkboxgroup__longdescription'),
            helpDescHTML = $helpDesc.html(),
            $radioBtn = $radioGroup.find('.cmp-adaptiveform-checkboxgroup-item'),
            helpIconWrapperHTML = '<div class="cmp-adaptiveform-checkboxgroup__questionmark" style="position:static"></div>',
            helpDesWrapperHTML = '<div class="cmp-adaptiveform-checkboxgroup__longdescription__custom long"></div>';

        $helpDesc.hide();
        helpDescHTML = helpDescHTML.split(';;');
        $helpIcon.remove();
        $radioBtn.each(function (idx, val) {
            if (helpDescHTML[idx].replace(/<[^>]*>/g, "").trim().length === 0) {
                return true;
            }
            var $this = $(this);
            $this.find('label').after(helpIconWrapperHTML);
            $this.append(helpDesWrapperHTML);
            $this.find('.cmp-adaptiveform-checkboxgroup__longdescription__custom').html(helpDescHTML[idx]).toggle();
            $this.find('.cmp-adaptiveform-checkboxgroup__questionmark').click(function (e) {
                $(this).parents('.cmp-adaptiveform-checkboxgroup-item').find('.cmp-adaptiveform-checkboxgroup__longdescription__custom').toggle();
                e.stopPropagation();
            });
        });
    }
}


/**
 * setRegistrationThankYouPageUrl
 * @name setRegistrationThankYouPageUrl
 * @param {string} url - The URL to set for the Registration thank you page.
 * @param {string} [paramName] - The name of the URL parameter to set.
 * @param {string} [paramValue] - The value of the URL parameter to set.
 * @param {string} [secondParamName] - The name of the URL parameter to set.
 * @param {string} [secondParamValue] - The value of the URL parameter to set.
 * @param {scope} globals - The global scope object.
 */
function setRegistrationThankYouPageUrl(url, paramName, paramValue, secondParamName, secondParamValue, globals) {
    if (paramName && paramValue && secondParamName && secondParamValue) {
        window.abbviecloudforms.core.formProperties.registrationthankyoupageurl = url + "?" + paramName + "=" + paramValue + "&" + secondParamName + "=" + secondParamValue;
    } else if (paramName && paramValue) {
        window.abbviecloudforms.core.formProperties.registrationthankyoupageurl = url + "?" + paramName + "=" + paramValue;
    } else if (secondParamName && secondParamValue) {
        window.abbviecloudforms.core.formProperties.registrationthankyoupageurl = url + "?" + secondParamName + "=" + secondParamValue;
    } else {
        window.abbviecloudforms.core.formProperties.registrationthankyoupageurl = url;
    }
}

/**
 * setDsaRegistrationThankYouPageUrl
 * @name setDsaRegistrationThankYouPageUrl
 * @param {string} url - The URL to set for the DSA registration thank you page.
 * @param {string} [paramName] - The name of the URL parameter to set.
 * @param {string} [paramValue] - The value of the URL parameter to set.
 * @param {scope} globals - The global scope object.
 */
function setDsaRegistrationThankYouPageUrl(url, paramName, paramValue, globals) {
    if (paramName && paramValue) {
        window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl = url + "?" + paramName + "=" + paramValue;
    } else {
        window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl = url;
    }

}

/**
 * loadFormDynamically
 * @name loadFormDynamically
 * @param {string} adaptiveFormPath - Adaptive form or fragment path (starting with /content/af).
 */

function loadFormDynamically(adaptiveFormPath) {
    guideBridge.loadAdaptiveForm({
        success: function (guideResultObj) {
            console.log("html is " + guideResultObj.data);
        },
        error: function (guideResultObj) {
            console.log("loadFormDynamically :: Error in loading adaptive form ");
        },
        path: adaptiveFormPath
    });
}

/**
 * Initalize Allergan Savings Card Unsubscribe Form
 * @name initializeAllerganSavingsCardUnsubscribeForm
 * @param {object} linzessPanel
 * @param {object} linzessSourceIdObject
 * @param {object} linzessCampainIdObject
 * @param {object} loloUnsubscribePanel
 * @param {object} loloSourceIdObject
 * @param {object} loloWebsiteIdObject
 * @param {object} fetzimaUnsubscribePanel
 * @param {object} fetzimaSourceIdObject
 * @param {object} crinoneUnsubscribePanel
 * @param {object} crinoneSourceIdObject
 * @param {object} taytullaUnsubscribePanel
 * @param {object} tatullaSourceIdObject
 * @param {object} savellaUnsubsribePanel
 * @param {object} savellaSourceIdObject
 * @param {object} savellatopicIdObject
 * @param {scope} globals
 */
function initializeAllerganSavingsCardUnsubscribeForm(linzessPanel, linzessSourceIdObject, linzessCampainIdObject,
                                                      loloUnsubscribePanel, loloSourceIdObject, loloWebsiteIdObject,
                                                      fetzimaUnsubscribePanel, fetzimaSourceIdObject,
                                                      crinoneUnsubscribePanel, crinoneSourceIdObject,
                                                      taytullaUnsubscribePanel, tatullaSourceIdObject,
                                                      savellaUnsubsribePanel, savellaSourceIdObject, savellatopicIdObject,
                                                      globals) {
    var brand = baseUrlGetParam('brand');
    sessionStorage.setItem('brand', brand);
    switch (brand) {
        case 'linzess':
            globals.functions.setProperty(linzessPanel, {visible: true});
            analyticspayload.init(linzessPanel.metadataPanel.analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
            admp_analytics_functions.updateDigitalDataObject('linzessPanel');
            globals.functions.setProperty(linzessSourceIdObject, {'value': '1002'});
            globals.functions.setProperty(linzessCampainIdObject, {'value': '99'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.unboundBrandName, {'value': 'fm-brandname-linzesscom'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.campaignMasterId, {'value': '629e2fc238878S2tLINZESSSCCOM'});
            break;
        case 'loloestrin':
            globals.functions.setProperty(loloUnsubscribePanel, {visible: true});
            analyticspayload.init(loloUnsubscribePanel.metadataPanel.analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
            admp_analytics_functions.updateDigitalDataObject('LoloUnsubscribePanel');
            globals.functions.setProperty(loloSourceIdObject, {'value': '99'});
            globals.functions.setProperty(loloWebsiteIdObject, {'value': '99'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.unboundBrandName, {'value': 'fm-brandname-loloestrin'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.campaignMasterId, {'value': '58b6903a8c774ccfbae3c4b598d0eLOLOESTRINCOM'});
            break;
        case 'fetzima':
            globals.functions.setProperty(fetzimaUnsubscribePanel, {visible: true});
            analyticspayload.init(fetzimaUnsubscribePanel.metadataPanel.analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
            admp_analytics_functions.updateDigitalDataObject('FetzimaUnsubscribePanel');
            globals.functions.setProperty(fetzimaSourceIdObject, {'value': '1002'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.unboundBrandName, {'value': 'fm-brandname-fetzima'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.campaignMasterId, {'value': '789e2fc235178a9eFETZIMACOM'});
            break;
        case 'crinone':
            globals.functions.setProperty(crinoneUnsubscribePanel, {visible: true});
            analyticspayload.init(crinoneUnsubscribePanel.metadataPanel.analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
            admp_analytics_functions.updateDigitalDataObject('CrinoneUnsubscribePanel');
            globals.functions.setProperty(crinoneSourceIdObject, {'value': '1002'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.unboundBrandName, {'value': 'fm-brandname-crinone'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.campaignMasterId, {'value': '789e2fc235147a9pCRINONECOM'});
            break;
        case 'taytulla':
            globals.functions.setProperty(taytullaUnsubscribePanel, {visible: true});
            analyticspayload.init(taytullaUnsubscribePanel.metadataPanel.analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
            admp_analytics_functions.updateDigitalDataObject('TaytullaUnsubscribePanel');
            globals.functions.setProperty(tatullaSourceIdObject, {'value': '1002'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.unboundBrandName, {'value': 'fm-brandname-taytulla'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.campaignMasterId, {'value': '789e2fc235147a5qTAYTULLACOM'});
            break;
        case 'savella':
            globals.functions.setProperty(savellaUnsubsribePanel, {visible: true});
            analyticspayload.init(savellaUnsubsribePanel.metadataPanel.analyticsMetadataPanel.analyticspayloadhiddenfield.$value);
            admp_analytics_functions.updateDigitalDataObject('savellaPanel');
            globals.functions.setProperty(savellaSourceIdObject, {'value': '1002'});
            var topicId = baseUrlGetParam('topicID');
            globals.functions.setProperty(savellatopicIdObject, {'value': topicId});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.unboundBrandName, {'value': 'fm-brandname-savella'});
            globals.functions.setProperty(globals.form.metadataPanel.formMetadataPanel.campaignMasterId, {'value': '789e2fc235147a5pSAVELLACOM'});
            break;
        default:
            globals.functions.setProperty(taytullaUnsubscribePanel, {visible: false});
            globals.functions.setProperty(savellaUnsubsribePanel, {visible: false});
            globals.functions.setProperty(loloUnsubscribePanel, {visible: false});
            globals.functions.setProperty(crinoneUnsubscribePanel, {visible: false});
            globals.functions.setProperty(fetzimaUnsubscribePanel, {visible: false});
            globals.functions.setProperty(linzessPanel, {visible: false});
    }
}

/**
 * getEmailfromUrlParam
 * @name getEmailfromUrlParam
 * @param {object} emailField
 * @param {string} queryString
 * @param {scope} globals
 */
function getEmailfromUrlParam(emailField, queryString, globals) {
    if (baseUrlGetParam(queryString)) {
        var email = baseUrlGetParam(queryString);
        globals.functions.setProperty(emailField, {'value': email.replace('%40', '@').replace('%2540', '@')});
    } else if (baseUrlGetParam('email')) {
        var email = baseUrlGetParam('email');
        globals.functions.setProperty(emailField, {'value': email.replace('%40', '@').replace('%2540', '@')});
    }
}

/**
 * showThankYouPanelInsuType
 * @name showThankYouPanelInsuType Show Hide Panels based on Insu Type parameter
 * @param {object} CardPresentPanel
 * @param {object} DefaultSuccessPanel
 * @param {object} ProspectSuccessDefaultPanel
 * @param {scope} globals
 */
function showThankYouPanelInsuType(CardPresentPanel, DefaultSuccessPanel, ProspectSuccessDefaultPanel, globals) {
    var coPayCardDetails = JSON.parse(localStorage.getItem("admp_cci"));
    var insType = "";
    if (getQueryVariable("insuType") != "false") {
        insType = getQueryVariable("insuType");
    }
    if (insType == "1" && coPayCardDetails) {
        globals.functions.setProperty(CardPresentPanel, {visible: true});
        globals.functions.setProperty(DefaultSuccessPanel, {visible: false});
    } else {
        globals.functions.setProperty(CardPresentPanel, {visible: false});
        globals.functions.setProperty(DefaultSuccessPanel, {visible: true});
        globals.functions.setProperty(ProspectSuccessDefaultPanel, {visible: true});
    }

}

/**
 * toggleContentUpaThankYou
 * @name toggleContentUpaThankYou
 * @param {string} sessionKey
 * @param {string} sessionVal
 * @param {string} cssClass1
 * @param {string} cssDefaultClass
 * @param {scope} globals
 */
function toggleContentUpaThankYou(sessionKey, sessionVal, cssClass1, cssDefaultClass, globals) {
    $(document).ready(function () {
        if (getSessionStorage(sessionKey) === sessionVal) {
            window.toggleContent(cssClass1);
        } else {
            window.toggleContent(cssDefaultClass);
        }
    });
}

/**
 * Handle Anchor Tag Clicks out of iFrame
 * @name handleAnchorTagClicksOutOfIFrame
 * @param {string} anchorClassName
 */
function handleAnchorTagClicksOutOfIFrame(anchorClassName) {
    $(document).ready(function () {
        $("." + anchorClassName).click(function () {
            console.log("Handler for .click() called." + $(this).attr("data-url"));
            window.parent.open($(this).attr("data-url"), "_self");
        });
    });
}

/**
 * Handle Anchor Tag Clicks with Delegation
 * @name handleAnchorTagClicksWithDelegation
 * @param {string} anchorClassName
 */
function handleAnchorTagClicksWithDelegation(anchorClassName) {
    $(document).ready(function () {
        // Attach the click handler to a static parent element (e.g., document.body)
        // and use the second argument to filter for the target elements.
        $(document.body).on("click", "." + anchorClassName, function (event) {
            event.preventDefault(); // Prevent default anchor behavior
            console.log("Handler for delegated .click() called." + $(this).attr("data-url"));
            window.parent.open($(this).attr("data-url"), "_self");
        });
    });
}

/**
 * Redirect with Query Params from Parent Page
 * @name redirectWithQueryParamsFromParentPage
 * @param {string} redirectUrl
 * @param {scope} globals
 */
function redirectWithQueryParamsFromParentPage(redirectUrl, globals) {
    var parentUrl = window.parent.location.href;
    parentUrl.replaceAll('%26', '&').replaceAll('%3F', '?');
    var queryParams = parentUrl.split('?')[1];
    if (queryParams) {
        var newUrl = redirectUrl + '?' + queryParams;
        window.parent.location.href = newUrl;
    } else {
        window.parent.location.href = redirectUrl;
    }
}

/**
 * Get Exposure Details
 * @name baseGetExposureDetails
 * @param {string} expId
 * @param {object} unsubscribepanel
 * @param {string} token
 * @param {scope} globals
 */
function baseGetExposureDetails(expId, unsubscribepanel, token, globals) {
    document.addEventListener("AF_FormContainerInitialised", function (event) {
        showLoader(true);
        var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
        var requestBody = {
            'exposureId': expId
        };
        var proxyApigeeData = {
            brandName: event.detail._model._jsonModel.properties.brandName,
            payload: JSON.stringify(requestBody),
            actionType: 'ApigeeHDS',
            formAction: 'GetExposureDetails',
            originName: baseDetectDeviceType(),
            requestType: 'GET',
            version: 'V1'
        };
        var onSuccess = function (data) {
            console.log('guideResultObject: ' + JSON.stringify(data));
            showLoader(false);
            if (data && data.status === 'SUCCESS' && data.results) {
                sessionStorage.setItem('expDetails', JSON.stringify(data.results));
                if (data.results.preferenceCenterPageUrl) {
                    globals.functions.setProperty(unsubscribepanel.redirectUrl, {value: data.results.preferenceCenterPageUrl + "/" + token || ''});
                }
                if (data.results.therapeuticArea) {

                    // Header Unsubscribe from ..
                    var textContentHeader = unsubscribepanel.textdraw_heading.$value;
                    textContentHeader = textContentHeader.replace('replace_dyamicString1', data.results.therapeuticArea);
                    globals.functions.setProperty(unsubscribepanel.textdraw_heading, {value: textContentHeader || ''});

                    // We are sorry to see you go ..
                    var textContent = unsubscribepanel.dynamicTherapeuticText.$value;
                    textContent = textContent.replace('THERAPEUTIC_AREA', data.results.therapeuticArea);
                    globals.functions.setProperty(unsubscribepanel.dynamicTherapeuticText, {value: textContent || ''});
                }
            } else {
                console.log("getCall failed");
                baseHandleHDSErrorResponse(data, globals);
            }
        };

        var onFailure = function () {
            showLoader(false);
            baseHandleErrorResponse(result, globals);
        };

        baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, onSuccess, onFailure);
    });


}

/**
 * Abbvie HDS Unsubscribe API Call
 * @name baseAbbAccessUnsubscribe
 * @param {string} expId
 * @param {string} email
 * @param {string} token
 * @param {string} formSource
 * @param {scope} globals
 */
function baseAbbAccessUnsubscribe(expId, email, token, formSource, globals) {
    showLoader(true);
    var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
    var requestBody = {
        'acid': '',
        'email': email,
        'exposureId': expId,
        'source': formSource,
        'userToken': token
    };
    var proxyApigeeData = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        payload: JSON.stringify(requestBody),
        actionType: 'ApigeeHDS',
        formAction: 'HDSUnsubscribe',
        originName: baseDetectDeviceType(),
        version: 'V1',
    };
    var onSuccess = function (data) {
        console.log('guideResultObject: ' + JSON.stringify(data));
        showLoader(false);
        if (data && data.status === 'SUCCESS' && data.results) {
            baseURLRedirection(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
        } else {
            baseHandleHDSErrorResponse(data, globals);
        }
    };
    var onFailure = function () {
        showLoader(false);
        baseHandleErrorResponse(data, globals);
    };
    baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, onSuccess, onFailure);
}

/**
 * setPreferenceCenterIframeUrlAbbvieAccessUnsubscribe
 * This function sets the preference center iframe URL for Abbvie Access Unsubscribe Form.
 * @name setPreferenceCenterIframeUrlAbbvieAccessUnsubscribe
 * @param {string} redirectUrl
 */
function setPreferenceCenterIframeUrlAbbvieAccessUnsubscribe(redirectUrl) {
    window.parent.document.querySelector('.upd-preference').style.display = 'none';
    var $pref_center = window.parent.document.getElementById('preference_center');
    $pref_center.setAttribute('src', redirectUrl);
    $pref_center.classList.remove("abbv-hide");
}

/**
 * setSkyIndicationAgreementTextBeforeAfterDermExperience
 * This function sets the agreement text based on the Sky selected indication for before-and-after/share-your-derm-experience form.
 * @name setSkyIndicationAgreementTextBeforeAfterDermExperience
 * @param {string} indictionSelected - The selected indication.
 * @param {object} agreementText - The agreement text object.
 * @param {scope} globals
 */
function setSkyIndicationAgreementTextBeforeAfterDermExperience(indictionSelected, agreementText, globals) {
    var textnew = agreementText.$value;

    if (indictionSelected === 'Plaque Psoriasis') {
        textnew = textnew.replaceAll("replace-indication-string1", " moderate to severe plaque psoriasis (“psoriasis”)");
        textnew = textnew.replaceAll("replace-indication-string2", " psoriasis");
        textnew = textnew.replaceAll("replace-indication-string3", " psoriasis");
    } else if (indictionSelected === 'Psoriatic Arthritis') {
        textnew = textnew.replaceAll("replace-indication-string1", " active psoriatic arthritis (“psoriatic arthritis”) in adults");
        textnew = textnew.replaceAll("replace-indication-string2", " Psoriatic arthritis");
        textnew = textnew.replaceAll("replace-indication-string3", " Psoriatic arthritis");
    } else if (indictionSelected === 'Both Plaque Psoriasis and Psoriatic Arthritis') {
        textnew = textnew.replaceAll("replace-indication-string1", " moderate to severe plaque psoriasis (“psoriasis”) and active psoriatic arthritis (“psoriatic arthritis”)");
        textnew = textnew.replaceAll("replace-indication-string2", " psoriasis and psoriatic arthritis");
        textnew = textnew.replaceAll("replace-indication-string3", " psoriasis and/or psoriatic arthritis");
    }

    globals.functions.setProperty(agreementText, {value: textnew});
}

/**
 * setRinvoqIndicationAgreementTextBeforeAfterDermExperience
 * This function sets the agreement text based on the Rinvoq selected indication for before-and-after/share-your-derm-experience form.
 * @name setRinvoqIndicationAgreementTextBeforeAfterDermExperience
 * @param {string} indictionSelected - The selected indication.
 * @param {object} agreementText - The agreement text object.
 * @param {scope} globals
 */
function setRinvoqIndicationAgreementTextBeforeAfterDermExperience(indictionSelected, agreementText, globals) {
    var textnew = agreementText.$value;

    if (indictionSelected === 'Atopic Dermatitis') {
        textnew = textnew.replaceAll("replace-indication-string1", "moderate to severe atopic dermatitis (AD)");
        textnew = textnew.replaceAll("replace-indication-string2", " atopic dermatitis");
        textnew = textnew.replaceAll("replace-indication-string3", " atopic dermatitis ");
    }

    globals.functions.setProperty(agreementText, {value: textnew});
}

/**
 * setCurrentDateToAgreementTextBeforeAfterDermExperience
 * This function sets the current date in the agreement text and a hidden date field for before-and-after/share-your-derm-experience form.
 * @name setCurrentDateToAgreementTextBeforeAfterDermExperience
 * @param {object} agreementText - The agreement text object.
 * @param {object} hiddenDateField - The hidden date field object.
 * @param {scope} globals
 */
function setCurrentDateToAgreementTextBeforeAfterDermExperience(agreementText, hiddenDateField, globals) {
    var textContent = agreementText.$value;

    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1;
    var yyyy = today.getFullYear();
    // Add leading zero if the day is less than 10
    if (dd < 10) {
        dd = '0' + dd;
    }
    // Add leading zero if the month is less than 10
    if (mm < 10) {
        mm = '0' + mm;
    }
    today = mm + '/' + dd + '/' + yyyy;
    textContent = textContent.replace("replaceTodayDate", today);
    globals.functions.setProperty(agreementText, {value: textContent});
    globals.functions.setProperty(hiddenDateField, {value: today});
}

/**
 * prefillBspEnrollmentSection
 * This function pre-fills the BSP enrollment section with decrypted user data.
 * @name prefillBspEnrollmentSection
 * @param {object} section - The BSP enrollment section object.
 * @param {scope} globals
 */
function prefillBspEnrollmentSection(section, globals) {
    decryptResponseGcm('admp_gp').then(function (decryptedData) {
        var result = JSON.parse(decryptedData);
        if (result) {
            if (result.firstName) {
                globals.functions.setProperty(section.patientInformation.patientfirstName, {value: result.firstName});
            }
            if (result.lastName) {
                globals.functions.setProperty(section.patientInformation.patientlastName, {value: result.lastName});
            }
            if (result.email && result.email.length && result.email[0].emailAddress) {
                globals.functions.setProperty(section.patientInformation.userName, {value: result.email[0].emailAddress});
                globals.functions.setProperty(section.patientContactInformation.emailinfo.patientEmailAddress, {value: result.email[0].emailAddress});
            }
            if (result.patientType && result.patientType === 'Caregiver') {
                globals.functions.setProperty(section.patientInformation.caregiverInformation, {visible: true});
            }
            if (result.caregiver.length && result.caregiver[0].firstName && result.caregiver[0].lastName) {
                globals.functions.setProperty(section.patientInformation.caregiverInformation.parentOrCaregiverFirstName, {value: result.caregiver[0].firstName});
                globals.functions.setProperty(section.patientInformation.caregiverInformation.parentOrCaregiverLastName, {value: result.caregiver[0].lastName});
                globals.functions.setProperty(section.patientInformation.caregiverInformation, {visible: true});
            }
        }
    });
}

/**
 * prefillHDSDashboard
 * This function pre-fills the hds dashboard section with decrypted user data.
 * @param {object} panelObj - The hds dashboard section object.
 * @param {scope} globals
 */
function prefillHDSDashboard(panelObj, globals) {
    var hdsUser = baseGetCookieValue('admp_hdsUser');
    var nonHdsRedirectURL = baseGetCookieValue('admp_nonHdsUserRedirect');
    if (hdsUser === 'false' && nonHdsRedirectURL) {
        //validates and redirect to thankyou page
        baseURLRedirection(nonHdsRedirectURL);
    } else {
        decryptResponseGcm('admp_tpd').then(function (decryptedData) {
            decryptedDataJson = JSON.parse(decryptedData);
            if (decryptedDataJson) {
                if (decryptedDataJson.status == "SUCCESS") {
                    var userDetails = decryptedDataJson.content;
                    globals.functions.setProperty(panelObj.namePanel.namePanel.nameInitialStatePanel.firstNameInitialText, {value: userDetails.firstName + ' ' + userDetails.lastName || ''});
                    globals.functions.setProperty(panelObj.emailPanel.emailpanel.emailInitialStatePanel.emailInitialText, {value: decodeURIComponent(baseGetCookieValue('admp_login_email')) || ''});
                    globals.functions.setProperty(panelObj.phonePanel.phonePanel.phoneInitialStatePanel.phoneInitialText, {value: userDetails.phone});

                    globals.functions.setProperty(panelObj.locationPanel.locationPanel.locationInitialPanel.initialAddress1Text, {value: userDetails.practice.address.line1 || ''});
                    globals.functions.setProperty(panelObj.locationPanel.locationPanel.locationInitialPanel.initialAddress2Text, {value: userDetails.practice.address.line2 || ''});
                    globals.functions.setProperty(panelObj.locationPanel.locationPanel.locationInitialPanel.initialFloorSuiteText, {value: userDetails.practice.address.suite || ''});
                    globals.functions.setProperty(panelObj.locationPanel.locationPanel.locationInitialPanel.initialCityText, {value: userDetails.practice.address.city || ''});
                    globals.functions.setProperty(panelObj.locationPanel.locationPanel.locationInitialPanel.initialStateText, {value: userDetails.practice.address.state || ''});
                    globals.functions.setProperty(panelObj.locationPanel.locationPanel.locationInitialPanel.initialZipcodeText, {value: userDetails.practice.address.zip || ''});
                }
            }
        });
    }
}

/**
 * Save User Profile Data in browser storage && error handling
 * @param response
 */
function saveHDSUserProfileData(response) {
    var cookieLife = 7 * 60 * 60;

    //Ignore the api cookie age - set it to 12 minutes, so that browser deletes it before token expires on server (15 min)
    setCookie('admp_login_token', response.data.id, true, 720);

    setCookie('admp_login_email', response.data.login, true, cookieLife);
    setCookie('admp_login_userid', response.data.userId, true, cookieLife);
    setCookie('admp_ufln', response.data._links.user.name, true, cookieLife);
    setCookie('admp_login_type', 'okta', true, cookieLife);
    setCookie('admp_login_brandname', window.abbviecloudforms.core.formProperties.brandName, true, cookieLife);
    var hdsUser = response.data.hdsUser;
    setCookie('admp_hdsUser', hdsUser, true, cookieLife);
    setCookie('admp_nonHdsUserRedirect', response.data.registrationUrl, true, cookieLife);
    if (response && response.data.admp_gp_atoken) {
        localStorage.setItem('admp_tpd', response.data.admp_gp_atoken);
        if (response.data.id) {
            localStorage.setItem('admp_jeess_per', response.data.admp_jeess_per);
        }
        if (response.data.admp_pkcue) {
            localStorage.setItem('admp_pkcue', response.data.admp_pkcue);
        }
        if (response.data.admp_pkcue_frm) {
            localStorage.setItem('admp_pkcue_frm', response.data.admp_pkcue_frm);
        }
        if (response.data.admp_pkcue_n_frm) {
            localStorage.setItem('admp_pkcue_n_frm', response.data.admp_pkcue_n_frm);
        }
        if (response.data.educationUrl) {
            localStorage.setItem('educationUrl', response.data.educationUrl);
        }
        //Decrypt admp_tpd response and set cookie
        decryptResponseGcm('admp_tpd').then(function (decryptedData) {
            decryptedDataJson = JSON.parse(decryptedData);
            if (decryptedDataJson) {
                if (decryptedDataJson.status == 'SUCCESS') {
                    var userCta = baseUrlGetParam('cid');
                    var practice = decryptedDataJson.content.practice;
                    var maxUser = decryptedDataJson.content.practice.maxedgeUser;
                    var userIndication = decryptedDataJson.content.indication;
                    var userIndNPI = decryptedDataJson.content.practice.individualNpi;
                    var redirectionUrl;
                    if (localStorage.getItem('onlineEducation')) {
                        localStorage.removeItem('onlineEducation');
                        redirectionUrl = response.data.educationUrl;
                    } else {
                        redirectionUrl = response.data.dashboardUrl;
                    }
                    if (practice.hasOwnProperty('maxedgeUser')) {
                        setCookie('admp_maxedgeUser', maxUser, true, cookieLife);
                        if (userIndication && userIndication !== 'null') {
                            setCookie('admp_indication', userIndication, true, cookieLife);
                        }
                        if (userIndNPI && userIndNPI !== 'null') {
                            setCookie('admp_individualNpi', userIndNPI, true, cookieLife);
                        }
                        if (userCta) {
                            setCookie('admp_response_cid', userCta, true, cookieLife);
                            if (decryptedDataJson.content.indication && decryptedDataJson.content.practice.individualNpi) {
                                if (decryptedDataJson.content.practice.maxedgeUser == 'out') {
                                    var brandName = baseGetCookieValue('admp_login_brandname');
                                    var userSessionId = baseGetCookieValue('admp_login_token');
                                    var userId = baseGetCookieValue('admp_login_userid');
                                    var updatePayload = {
                                        userSessionId: userSessionId,
                                        individualNpi: userIndNPI,
                                        maxedgeUser: 'in',
                                        ctaId: userCta,
                                        indication: userIndication,
                                        modeOfContact: ''
                                    };
                                    $.ajax({
                                        url: '/bin/abbvieforms/api/okta',
                                        method: 'post',
                                        async: false,
                                        data: {
                                            brandName: brandName,
                                            formaction: 'MaxEdgeUpdateProfile',
                                            version: 'V1',
                                            userId: userId,
                                            data: JSON.stringify(updatePayload)
                                        }
                                    }).done(function (data) {
                                        setCookie('saml_request_path', redirectionUrl, true, cookieLife);
                                    }).fail(function (error) {
                                        console.error('Update maxedgeUser failed');
                                    });
                                } else {
                                    setCookie('saml_request_path', redirectionUrl, true, cookieLife);
                                }
                            } else {
                                setCookie('saml_request_path', response.data.updateProfileUrl, true, cookieLife);
                            }
                        } else {
                            if (!decryptedDataJson.content.indication || !decryptedDataJson.content.practice.individualNpi) {
                                setCookie('saml_request_path', response.data.updateProfileUrl, true, cookieLife);
                            } else {
                                setCookie('saml_request_path', redirectionUrl, true, cookieLife);
                            }
                        }
                    } else {
                        setCookie('saml_request_path', redirectionUrl, true, cookieLife);
                    }
                    setCookie('admp_ufln', decryptedDataJson.content.firstName + ' ' + decryptedDataJson.content.lastName, true, cookieLife);
                    localStorage.setItem('admp_fn', decryptedDataJson.content.firstName);
                    localStorage.setItem('admp_ln', decryptedDataJson.content.lastName);
                }
            }
            //redirect to dashboard page
            redirectToThankYouPage(response.data.redirectUrl);
        });
    }
}

/**
 * oktaRecoveryToken
 * @param {string} recoveryToken
 * @param {object} recoveryTokenFormPanel
 * @param {object} stateTokenTextbox
 * @param {scope} globals
 */
function oktaRecoveryToken(recoveryToken, recoveryTokenFormPanel, stateTokenTextbox, globals) {
    var dataInfo = {
        recoveryToken: recoveryToken
    };
    $.ajax({
        url: "/bin/abbvieforms/api/okta",
        method: "post",
        async: false,
        data: {
            brandName: window.abbviecloudforms.core.formProperties.brandName,
            formaction: "RecoveryToken",
            version: window.abbviecloudforms.core.formProperties.version,
            data: JSON.stringify(dataInfo)
        }
    }).done(function (response) {
        if (response.stateToken) {
            console.info(" success  ::  " + response.stateToken);
            globals.functions.setProperty(recoveryTokenFormPanel, {visible: true});
            globals.functions.setProperty(stateTokenTextbox, {value: response.stateToken});
        } else {
            oktaHandleErrorResponse(response);
            globals.functions.setProperty(recoveryTokenFormPanel, {visible: false});
        }
    }).fail(function (error) {
        console.error("Ajax request to authenticate failed.");
    });
}

function oktaHandleErrorResponse(json) {
    var globalError = true;
    if (json.errorCode) {
        var errorLabel = $('.err--label');
        errorLabel.hide();
        $(".generic-error-message").hide();
        var errorCode = json.errorCode;
        var errorMessage = json.errorSummary;
        showHdsError(errorLabel, errorCode, errorMessage, globalError);
    }
    baseSubmitReset();
}

function showHdsError(errorLabel, errorCode, errorMessage, globalError) {
    errorLabel.each(function (element) {
        if ($(this).hasClass('err' + errorCode)) {
            var classlist = $(this).attr("class");
            if (classlist.indexOf("child") !== -1) {
                var mainClass = $(this).attr("class").split(" ").filter(function (el) {
                    return el.indexOf("child-") != -1;
                });
                var value = mainClass[0].split('child-').pop();
                errorMessage = $(this)[0].innerText;
                $('.' + value).removeClass('validation-success').addClass('validation-failure').find('.guideFieldError').hide().html(errorMessage).show();
            } else {
                $(this).show().addClass('guideFieldError').css('visibility', 'visible').parents().eq(1).removeClass('hidden');
            }
            globalError = false;
        }
    });
    if (globalError) {
        $(".generic-error-message").show();
        $(".generic-error-codes").addClass('guideFieldError').css('visibility', 'visible').parents().eq(1).removeClass('hidden');
        if ($(".generic-error-message").parents().eq(1).hasClass("hidden")) {
            $(".generic-error-message").parents().eq(1).removeClass('hidden');
        }
    }
}

/**
 * Function to replace special characters with superscript for all elements with provided css class.
 * @name baseReplaceSpecialCharactersByCssClass
 * @param {string} cssClass
 * @param {scope} globals
 * @description Iterates through elements and removes special characters.
 */
function baseReplaceSpecialCharactersByCssClass(cssClass) {
    var clazz = '.' + cssClass;
    $(clazz).each(function () {
        if ($(this).html().match(/\^®/g) && $(this).html().match(/\^®/g).length > 0) {
            $(this).html($(this).html().replace(/\^®/g, "<sup>®</sup>"));
        }
        if ($(this).html().match(/\^©/g) && $(this).html().match(/\^©/g).length > 0) {
            $(this).html($(this).html().replace(/\^©/g, "<sup>©</sup>"));
        }
        if ($(this).html().match(/\^™/g) && $(this).html().match(/\^™/g).length > 0) {
            $(this).html($(this).html().replace(/\^™/g, "<sup>™</sup>"));
        }
        if ($(this).html().match(/\^†/g) && $(this).html().match(/\^†/g).length > 0) {
            $(this).html($(this).html().replace(/\^†/g, "<sup>†</sup>"));
        }
        if ($(this).html().match(/\^‡/g) && $(this).html().match(/\^‡/g).length > 0) {
            $(this).html($(this).html().replace(/\^‡/g, "<sup>‡</sup>"));
        }
    });
}

/**
 * Function to replace special characters with superscript for all elements with provided css class with delay.
 * @name baseReplaceSpecialCharactersByCssClassWithDelay
 * @param {string} cssClass
 * @param {number} delay
 * @param {scope} globals
 * @description Iterates through elements and removes special characters.
 */
function baseReplaceSpecialCharactersByCssClassWithDelay(cssClass, delay) {
    if (delay && delay > 0) {
        setTimeout(baseReplaceSpecialCharactersByCssClass, delay, cssClass);
    } else {
        baseReplaceSpecialCharactersByCssClass(cssClass);
    }
}

/**
 * Function to replace special characters with superscript for all elements with provided id.
 * @name baseReplaceSpecialCharactersById
 * @param {string} id
 * @param {scope} globals
 * @description Iterates through elements and removes special characters.
 */
function baseReplaceSpecialCharactersById(id) {
    var identifier = '#' + id;
    $(identifier).each(function () {
        if ($(this).html().match(/\^®/g) && $(this).html().match(/\^®/g).length > 0) {
            $(this).html($(this).html().replace(/\^®/g, "<sup>®</sup>"));
        }
        if ($(this).html().match(/\^©/g) && $(this).html().match(/\^©/g).length > 0) {
            $(this).html($(this).html().replace(/\^©/g, "<sup>©</sup>"));
        }
        if ($(this).html().match(/\^™/g) && $(this).html().match(/\^™/g).length > 0) {
            $(this).html($(this).html().replace(/\^™/g, "<sup>™</sup>"));
        }
        if ($(this).html().match(/\^†/g) && $(this).html().match(/\^†/g).length > 0) {
            $(this).html($(this).html().replace(/\^†/g, "<sup>†</sup>"));
        }
        if ($(this).html().match(/\^‡/g) && $(this).html().match(/\^‡/g).length > 0) {
            $(this).html($(this).html().replace(/\^‡/g, "<sup>‡</sup>"));
        }
    });
}

/**
 * Function to replace special characters with superscript for all elements with provided id with delay.
 * @name baseReplaceSpecialCharactersByIdWithDelay
 * @param {string} id
 * @param {number} delay
 * @param {scope} globals
 * @description Iterates through elements and removes special characters.
 */
function baseReplaceSpecialCharactersByIdWithDelay(id, delay) {
    if (delay && delay > 0) {
        setTimeout(baseReplaceSpecialCharactersById, delay, id);
    } else {
        baseReplaceSpecialCharactersById(id);
    }
}

/**
 * Method to clear api error messages on field validation.
 * @param {string} elementName
 * @description Clears api error messages on field validation.
 */
function baseClearAPIerrormessages(elementName) {
    var $el = $('.' + elementName);

    if ($el.find('.guideFieldError').length) {
        $el.find('.guideFieldError').hide();
        if ($el.hasClass('validation-failure')) {
            $el.removeClass('validation-failure').addClass('validation-success');
        }
    }
}

/**
 * Function to handle delay in ddg quiz panels.
 * @param cssClassName the class name
 * @param delayPanel the panel
 * @param somExp the som expression
 */
function baseDelayVisibility(cssClassName, delayPanel, somExp) {
    if (cssClassName && cssClassName.indexOf('abbv-delay-visibility') >= 0) {
        var classNames = cssClassName.split(' ');
        for (var i = 0; i < classNames.length; i++) {
            if (classNames[i].indexOf('abbv-delay-visibility') >= 0) {
                var delayClass = classNames[i].split('visibility-');
                if (classNames[i].indexOf('_nav') >= 0) {
                    classNames[i] = classNames[i].split('_nav')[0];
                }
                /*disable next and back button */
                $(".nextButton").css({"cursor": "not-allowed"});
                $(".nextButton").attr("data-disabled", true);
                $(".ddgQuiz-back-button").css({"cursor": "not-allowed"});
                $(".ddgQuiz-back-button").attr("data-disabled", true);
                hasDelay = true;
                setTimeout(function () {
                    if (($('.nextButton').attr('data-disabled') === "true" && $('.ddgQuiz-back-button').attr('data-disabled') === "true") || (delayPanel && delayPanel.jsonModel.name == 'ddgQuiz')) {
                        if (somExp) {
                            if (delayPanel == 'prevItem') {
                                window.guideBridge.setFocus(somExp, 'prevItem');
                            } else {
                                updateSummryForEachPanel(summaryObject);
                                updateSummaryPageContent();
                                window.guideBridge.setFocus(somExp, 'nextItem', true);
                            }
                        } else {
                            delayPanel.visible = true;
                        }
                        $(".nextButton").css({"cursor": "default"});
                        $(".nextButton").attr("data-disabled", false);
                        $(".ddgQuiz-back-button").css({"cursor": "default"});
                        $(".ddgQuiz-back-button").attr("data-disabled", false);
                    }
                }, delayClass[1] * 1000);
            }
        }
    } else {
        if ($('.nextButton').attr('data-disabled') === "false" || $('.nextButton').attr('data-disabled') == undefined) {
            if (somExp) {
                if (delayPanel == 'prevItem') {
                    window.guideBridge.setFocus(somExp, 'prevItem');
                } else {
                    updateSummryForEachPanel(summaryObject);
                    updateSummaryPageContent();
                    window.guideBridge.setFocus(somExp, 'nextItem', true);
                }
            } else {
                delayPanel.visible = true;
            }
        }
    }
}

/**
 * Function to update summary panel with the list of previously selected questions above every question
 * @param summaryList
 * @param panelNo
 */
function updateSummryForEachPanel(summaryList, panelNo) {
    clearSummaryPanel(summaryList);
    for (var item in summaryList) {
        var summaryValue = summaryList[item];
        if (typeof (summaryValue) == "object") {
            updateSummryForEachPanel(summaryValue);
        } else {
            if ($("." + item).parent().attr('class') && $("." + item).parent().attr('class').indexOf('abbv-quizddg-answer-') != -1) {
                var classList = $("." + item).parent()[0].classList;
                var que = filterKeyFromArray(classList, 'abbv-quizddg-answer-').split('abbv-quizddg-answer-')[1];
                $("." + item).parent().parent().show();
                if (summaryValue != " " && summaryValue != "unanswered") {
                    $(".singlepanel-update-summary .abbv-quizddg-answer-" + que).show();
                    $(".singlepanel-update-summary .abbv-quizddg-deftext-" + que).hide();
                    $('.' + item).text(summaryValue + " ");
                } else {
                    $(".singlepanel-update-summary .abbv-quizddg-deftext-" + que).show();
                }
            }
        }
    }
    var panel = parseInt(panelNo);
    if (panel) {
        for (var pno = 1; pno < panel; pno++) {
            if (!summaryList["abbv-quizddg-qtoken-q" + pno + "-a1"]) {
                $(".singlepanel-update-summary .abbv-quizddg-qtoken-q" + pno + "-a1").parent().parent().show();
                $(".singlepanel-update-summary .abbv-quizddg-qtoken-q" + pno + "-a").parent().parent().show();
                $(".singlepanel-update-summary .abbv-quizddg-deftext-" + pno).show();
            }
        }
    }
}

/**
 * Function to update summary page.
 */
function updateSummaryPageContent() {
    $(".abbv-quizddg-summarypanel span").each(function () {
        if ($(this).attr("class") && $(this).attr("class").indexOf('abbv-quizddg-qtoken-q') != -1) {
            var identifier = $(this).attr('class').slice($(this).attr("class").indexOf('abbv-quizddg-qtoken-q')).split(" ")[0];
            var parClassList = $(this).parent().parent().parent()[0].classList;
            var classList = $(this).parent().parent()[0].classList;
            var questionNumber = $(this).parent().parent().is("ul") ? filterKeyFromArray(parClassList, 'abbv-quizddg-q').split('abbv-quizddg-q')[1] : filterKeyFromArray(classList, 'abbv-quizddg-q').split('abbv-quizddg-q')[1];
            if (summaryObject[identifier] == "unanswered") {
                $(this).parent().hide();
                $(this).parents().find(".abbv-quizddg-deftext-q" + questionNumber).show();
            } else if (summaryObject[identifier] != " " && summaryObject[identifier] != "" && summaryObject[identifier] != undefined) {
                this.innerText = summaryObject[identifier];
                $(this).parents().find(".abbv-quizddg-deftext-q" + questionNumber).hide();
                $(this).parent().show();
            } else {
                $(this).parent().hide();
            }
        }
    });
}

/**
 * Function  to clear the update summary panel to remove span tags whose values are not selected.
 * @param summaryList
 */
function clearSummaryPanel(summaryList) {
    if (summaryList) {
        for (var item in summaryList) {
            $('.' + item).parent().hide();
        }
    } else {
        $(".singlepanel-update-summary span").each(function () {
            if ($(this).attr("class") && $(this).attr("class").indexOf('abbv-quizddg-qtoken-q') != -1 && $(this).parent().attr('class') && $(this).parent().attr('class').indexOf('abbv-quizddg-answer-') != -1) {
                var classList = $(this).parent()[0].classList;
                var quest = filterKeyFromArray(classList, 'abbv-quizddg-answer-').split('abbv-quizddg-answer-')[1];
                $(".singlepanel-update-summary .abbv-quizddg-answer-" + quest).hide();
                $(".singlepanel-update-summary .abbv-quizddg-deftext-" + quest).hide();
                $(this).parent().parent().hide();
            }
        });
    }
}

/**
 * Filters value from array list.
 * @param list
 * @param key
 */
function filterKeyFromArray(list, key) {
    if (list && list.length > 0) {
        for (var m = 0; m < list.length; m++) {
            if (list[m].indexOf(key) != -1) {
                return (list[m]);
            }
        }
    }
}

/**
 * showElementByCssClass
 * $(cssClass).show();
 * "." must be added to the cssClass while calling this function.
 * @name showElementByCssClass
 * @param {string} cssClass
 */
function showElementByCssClass(cssClass) {
    $(cssClass).show();
}

/**
 * hideElementByCssClass
 * $(cssClass).hide();
 * "." must be added to the cssClass while calling this function.
 * @name hideElementByCssClass
 * @param {string} cssClass
 */
function hideElementByCssClass(cssClass) {
    $(cssClass).hide();
}

/**
 * setCssStylingByCssClass
 * This function sets a specific CSS property and value for all elements with the given CSS class.
 * $(cssClass).css(cssProperty, cssValue);
 * @name setCssStylingByCssClass
 * @param {string} cssClass - The CSS class selector (including the dot, e.g., '.my-class').
 * @param {string} cssProperty - The CSS property to set (e.g., 'color', 'font-size').
 * @param {string} cssValue - The value to assign to the CSS property (e.g., 'red', '16px').
 */
function setCssStylingByCssClass(cssClass, cssProperty, cssValue) {
    $(cssClass).css(cssProperty, cssValue);
}

/**
 * Adds a class to a specific element.
 * @param {string} selector the selector to find the element(s), e.g. .psa-progression-yes
 * @param {string} cssClass the class to add, e.g. abbv-show
 * @param {boolean} [inParent] defines if it must be added in window.parent
 */
function addCssClassToElement(selector, cssClass, inParent) {
    if (inParent) {
        window.parent.$(selector).addClass(cssClass);
    } else {
        $(selector).addClass(cssClass);
    }
}

/**
 * Removes a class from a specific element.
 * @param {string} selector the selector to find the element(s), e.g. .psa-progression-yes
 * @param {string} cssClass the class to remove add, e.g. abbv-show
 * @param {boolean} inParent defines if it must be added in window.parent
 */
function removeCssClassFromElement(selector, cssClass, inParent) {
    if (inParent) {
        window.parent.$(selector).removeClass(cssClass);
    } else {
        $(selector).removeClass(cssClass);
    }
}

/**
 * Removes an attribute from a specific element.
 * @name removeAttributeFromElement
 * @param {string} selector the selector to find the element(s), e.g. .psa-progression-yes
 * @param {string} attribute the attribute to remove
 * @param {boolean} inParent defines if it must be added in window.parent
 */
function removeAttributeFromElement(selector, attribute, inParent) {
    if (inParent) {
        window.parent.$(selector).removeAttr(attribute);
    } else {
        $(selector).removeAttr(attribute);
    }
}

/**
 * Add an attribute to a specific element.
 * @name addAttributeToElement
 * @param {string} selector the selector to find the element(s), e.g. .psa-progression-yes
 * @param {string} attribute the attribute to add
 * @param {string} value the value of the attribute to add
 * @param {scope} globals defines if it must be added in window.parent
 */
function addAttributeToElement(selector, attribute, value, globals) {
    $(selector).attr(attribute, value);
}

/**
 * Counts the number of elements based on selector.
 * @param {string} selector the selector to find the element(s), e.g. .psa-progression-yes
 * @param {boolean} inParent defines if it must be executed in window.parent
 */
function countElements(selector, inParent) {
    if (inParent) {
        return window.parent.$(selector).length;
    } else {
        return $(selector).length;
    }
}

/**
 * Sets html to an element.
 * @param selector the selector to find the element(s), e.g. .admp-unsubscribe-email
 * @param html the html to set
 */
function setHtmlInElement(selector, html) {
    $(selector).html(html);
}

/**
 * Sets html to an element from label.
 * In case of radiobutton and checkbox not value is set but label.
 * @param {string} selector the selector to find the element(s), e.g. .admp-unsubscribe-email
 * @param {object} html the html to set
 */
function setHtmlInElementFromLabel(selector, html) {
    var indexNbr = html.$enum.indexOf(html.$value);
    var label = html.$enumNames[indexNbr];

    $(selector).html(label);
}

/**
 * Gets the value of an html element.
 * $(selector).val();
 * @param {string} selector the selector to find the element(s), e.g. .admp-unsubscribe-email
 */
function getValueOfHtmlElement(selector) {
    return $(selector).val();
}

/**
 * Gets the html element.
 * $(selector);
 * @param {string} selector the selector to find the element(s), e.g. .admp-unsubscribe-email
 */
function getHtmlElement(selector) {
    return $(selector);
}

/**
 * Sets the value before the html element.
 * $(selector).before(valueBefore);
 * @param {string} selector the selector to find the element(s), e.g. .admp-unsubscribe-email
 * @param {string} valueBefore the value to be set
 */
function setBeforeHtmlElement(selector, valueBefore) {
    $(selector).before(valueBefore);
}

/**
 * Sets the value after the html element.
 * $(selector).after(valueBefore);
 * @param {string} selector the selector to find the element(s), e.g. .admp-unsubscribe-email
 * @param {string} valueAfter the value to be set
 */
function setAfterHtmlElement(selector, valueAfter) {
    $(selector).after(valueAfter);
}

/**
 * scrollTopWithOffsetAndTimeout
 * This function scrolls the page to a specified vertical offset after a given timeout.
 * setTimeout(function() {
 *         $('html, body').animate({ scrollTop: offset }, 'slow');
 *     }, timeout);
 * @name scrollTopWithOffsetAndTimeout
 * @param {number} offset - The vertical offset to scroll to.
 * @param {number} timeout - The delay in milliseconds before scrolling.
 */
function scrollTopWithOffsetAndTimeout(offset, timeout) {
    setTimeout(function () {
        $('html, body').animate({scrollTop: offset}, 'slow');
    }, timeout);
}

/**
 * removeNewLineCharacters
 *
 */
function removeNewLineCharacters(textField) {
    return textField.$value.replace('\n', '');
}

/**
 * mergeCurrentlyTreatmentResultsOrilissapatDdg
 * This function merges multiple treatment result strings into a single formatted string for Orilissa PAT DDG.
 *
 * @name mergeCurrentlyTreatmentResultsOrilissapatDdg
 * @param {string} hormonalBirthValue
 * @param {string} otcValue
 * @param {string} nsaidValue
 * @param {string} opioidValue
 * @param {string} gnrhValue
 * @param {string} surgeryValue
 * @param {object} txtotherValue
 * @param {object} otherValue
 */
function mergeCurrentlyTreatmentResultsOrilissapatDdg(hormonalBirthValue, otcValue, nsaidValue, opioidValue, gnrhValue, surgeryValue, txtotherValue, otherValue) {
    var result = '';
    if (hormonalBirthValue) {
        result += hormonalBirthValue + '\n';
    }
    if (otcValue) {
        result += otcValue + '\n';
    }
    if (nsaidValue) {
        result += nsaidValue + '\n';
    }
    if (opioidValue) {
        result += opioidValue + '\n';
    }
    if (gnrhValue) {
        result += gnrhValue + '\n';
    }
    if (surgeryValue) {
        result += surgeryValue + '\n';
    }
    if (otherValue.$value && otherValue.$value === 0) {
        result += otherValue.$label.value + " " + otherValue.$value;
    }
    return result.trim();
}

/**
 * mergePreviouslyTreatmentResultsOrilissapatDdg
 * This function merges multiple treatment result strings into a single formatted string for Orilissa PAT DDG.
 *
 * @name mergePreviouslyTreatmentResultsOrilissapatDdg
 * @param {string} hormonalBirthValue
 * @param {string} otcValue
 * @param {string} nsaidValue
 * @param {string} opioidValue
 * @param {string} gnrhValue
 * @param {string} surgeryValue
 * @param {object} txtotherValue
 * @param {object} otherValue
 */
function mergePreviouslyTreatmentResultsOrilissapatDdg(hormonalBirthValue, otcValue, nsaidValue, opioidValue, gnrhValue, surgeryValue, txtotherValue, otherValue) {
    var result = '';
    if (hormonalBirthValue) {
        result += hormonalBirthValue + '\n';
    }
    if (otcValue) {
        result += otcValue + '\n';
    }
    if (nsaidValue) {
        result += nsaidValue + '\n';
    }
    if (opioidValue) {
        result += opioidValue + '\n';
    }
    if (gnrhValue) {
        result += gnrhValue + '\n';
    }
    if (surgeryValue) {
        result += surgeryValue + '\n';
    }
    if (otherValue.$value && otherValue.$value === 1) {
        result += otherValue.$label.value + " " + otherValue.$value;
    }
    return result.trim();
}

/**
 * mslSearchAction
 * @name mslSearchAction
 * @param {string} zipAreaCode
 * @param {string} therapeuticArea
 * @param {string} subTherapeuticArea
 * @param {object} resultPanel
 * @param {scope} globals
 */
function mslSearchAction(zipAreaCode, therapeuticArea, subTherapeuticArea, resultPanel, globals) {
    var payload = {};
    payload.zipcode = zipAreaCode;
    payload.therapeuticArea = therapeuticArea.replaceAll(' ', '%20');
    if (subTherapeuticArea) {
        payload.subTherapeuticArea = subTherapeuticArea.replaceAll(' ', '%20');
    }

    var proxyApigeeData = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        payload: JSON.stringify(payload),
        actionType: 'Apigee',
        originName: baseDetectDeviceType(),
        formAction: "FindMyMsl",
        requestType: 'GET',
        version: 'V1'
    };

    var mslSearchSuccess = function (response) {
        var searchResults = response;
        var $searchContainer = $('.msl-search-result');
        var $emptyResult = $('.empty-result');
        /* The proxy answers a rejected captcha with HTTP 200 and an error envelope, so it has to
           be detected here or it would render as an empty result set. */
        if (isCaptchaValidationFailure(searchResults)) {
            globals.functions.setProperty(resultPanel, {visible: true});
            $searchContainer.hide();
            $emptyResult.show();
            handleCaptchaValidationFailure(globals);
            return;
        }
        globals.functions.setProperty(resultPanel, {visible: true});
        if (searchResults.length) {
            $searchContainer.show();
            $emptyResult.hide();
            $searchContainer.empty();
            var searchContent = [];
            var $searchResultContent = $('.resultDetailsText').html();
            for (var i = 0; i < searchResults.length; i++) {
                var item = searchResults[i];
                searchContent[i] = $searchResultContent.replace(/#name#/, item.firstName + ' ' + item.lastName)
                    .replace(/#phone#/, item.phone)
                    .replace(/#email#/, item.email_address);
            }
            $searchContainer.html(searchContent);
            window.parent.digitalData.page.form.stepName = 'submit';
            if (analyticspayload.validPayload) {
                analyticspayload.getFormCompletePayload();
            }
        } else {
            $searchContainer.hide();
            $emptyResult.show();
            admp_analytics_functions.onFormSubmitError(response);
        }
    };

    var mslSearchFailed = function (response) {
        console.error('Error in Fetching API response');
    };

    getEnterpriseToken(proxyApigeeData.formAction).then(function (token) {
        /* No token means captcha is unavailable on this page - fall back to the legacy proxy so the
           search still works, ungated. See resolveProxyApiUrl. */
        var apiUrl = resolveProxyApiUrl(token);
        if (token) {
            proxyApigeeData.admpInvisibleCaptchaData = token;
        }
        baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, mslSearchSuccess, mslSearchFailed);
    });
}

/** Show psa progression in psoriatic arthritis form
 * @name showPsaProgression
 * @param {object} quizQuestion1
 * @param {object} quizQuestion2
 * @param {object} quizQuestion3
 * @param {scope} globals
 */
function showPsaProgression(quizQuestion1, quizQuestion2, quizQuestion3, globals) {
    if (quizQuestion1.$value == "Yes" || quizQuestion2.$value == "Yes" || quizQuestion3.$value == "Yes") {
        window.parent.$(".psa-progression-yes").addClass('abbv-show');
        window.parent.$(".psa-progression-no").addClass('abbv-hide');
    }
    if (quizQuestion1.$value == "No" && quizQuestion2.$value == "No" && quizQuestion3.$value == "No") {
        window.parent.$(".psa-progression-no").addClass('abbv-show');
        window.parent.$(".psa-progression-yes").addClass('abbv-hide');
    }
}

/**
 * redirectWithTimeout
 * @name redirectWithTimeout
 * @param {string} url
 * @param {number} timeout in milliseconds
 */
function redirectWithTimeout(url, timeout) {
    setTimeout(function () {
        window.location.href = url;
    }, timeout);
}

/**
 * baseScrollToViewPanel
 * This function scrolls the parent window to bring the specified panel into view.
 * @name baseScrollToViewPanel
 * @param {string} clickedPanel - The CSS class of the clicked panel.
 */
function baseScrollToViewPanel(clickedPanel) {
    var clickedPanelId = $('.' + clickedPanel).closest('div[data-guide-parent-id]').attr('id');
    var iframeTop = $(window.parent.document).find('.cmp-adaptiveform-container').offset() ? $(window.parent.document).find('.cmp-adaptiveform-container').offset().top : 0;
    var expandedDivIdEle = document.getElementById(clickedPanelId);
    var clickedPanelTop = 0;
    if ($(window.parent.fixedTracking).length !== 0 && $(window.parent.fixedTracking.getOffset('top')) && $(window.parent.fixedTracking.getOffset('top'))[0] > 0) {
        clickedPanelTop = $(expandedDivIdEle).offset().top + iframeTop - $(window.parent.fixedTracking.getOffset('top'))[0];
    } else {
        clickedPanelTop = $(expandedDivIdEle).offset().top + iframeTop;
    }
    $('html, body', window.parent.document).animate({scrollTop: clickedPanelTop - 40}, 350);
}

/**
 * password strength meter logic
 * @param {string} passwordElm
 */
function basePassWordStrengthCheck(passwordElm) {
    var total = 0;
    var lowerCaseRegex = new RegExp(/(?=.*?[a-z])/);
    var capsRegex = new RegExp(/(?=.*?[A-Z])/);
    var numberRegex = new RegExp(/(?=.*?[0-9])/);
    var specialRegex = new RegExp(/(?=.*?[#?!@$%^&*_~()])/);
    var strongRegex = new RegExp(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*_~()]).{8,}$/);
    $('.strength-text').hide();
    $('.' + passwordElm + ' input[type="password"]').on('propertychange input', function () {
        var pwdVal = this.value;
        if (pwdVal) {
            $('.strength-meter').addClass('show-meter');
            if (strongRegex.test(pwdVal)) {
                basePasswordStrengthMeterUpdate(4, "strong");
            } else {
                total = capsRegex.test(pwdVal) + lowerCaseRegex.test(pwdVal) + numberRegex.test(pwdVal) + specialRegex.test(pwdVal);
                if (total <= 2) {
                    basePasswordStrengthMeterUpdate(2, 'weak');
                } else {
                    basePasswordStrengthMeterUpdate(3, 'medium');
                }
            }
        } else {
            $('.strength-meter').removeClass('show-meter');
        }
    });
}

/**
 * password strength  meter color fill
 * @param strengthVal
 * @param strengthClass
 */
function basePasswordStrengthMeterUpdate(strengthVal, strengthClass) {
    var strengthMeterStyleObj = {
        weak: {
            strengthLabel: {"color": "#d21d36"},
            meter: {"background": "#d21d36", "width": "60%"}
        },
        medium: {
            strengthLabel: {"color": "#fc9707"},
            meter: {"background": "#fc9707", "width": "80%"}
        },
        strong: {
            strengthLabel: {"color": "#37cd6f"},
            meter: {"background": "#37cd6f", "width": "100%"}
        }
    };
    $('.strength-meter-fill').attr('data-strength', strengthVal).css(strengthMeterStyleObj[strengthClass].meter);
    $('.strength-text').hide();
    $(".strength-text-" + strengthClass).css(strengthMeterStyleObj[strengthClass].strengthLabel).show();
}

/**
 * Method for restricting custom password field character length
 * @param customClass
 * @param limit
 */
function baseLimitInputFieldEntry(customClass, limit) {
    var target = document.querySelector('.' + customClass + ' input');
    target.addEventListener('keyup', function () {
        if (target.value.length > limit) {
            target.value = target.value.slice(0, limit);
        }
    });
}

/**
 * @name epiQuizTextsToggling Toggle symptoms/diagnosis texts
 * @param {object} epiSymptomsText
 * @param {object} epiDiagnosisText
 * @param {scope} globals
 * @description Toggles the visibility of epi quiz texts based on the user's answers selections.
 */
function epiQuizTextsToggling(epiSymptomsText, epiDiagnosisText, globals) {
    const controlRadioButton = document.querySelector('.greasyStoolRadioButton input[type="radio"]:checked');

    let symptomsTextVisible = true;

    if (controlRadioButton && controlRadioButton.value !== 'Never') {
        const getInputSelectorByValue = (value) => `.cmp-adaptiveform-radiobutton:not(.greasyStoolRadioButton) input[type="radio"][value="${value}"]:checked`;

        const almostAlwaysRadioCount = document.querySelectorAll(getInputSelectorByValue("Almost Always")).length;
        const oftenRadioCount = document.querySelectorAll(getInputSelectorByValue("Often")).length;

        if (almostAlwaysRadioCount + oftenRadioCount >= 5) {
            symptomsTextVisible = false;
        }
    }

    globals.functions.setProperty(epiSymptomsText, {visible: symptomsTextVisible});
    globals.functions.setProperty(epiDiagnosisText, {visible: !symptomsTextVisible});
}

/**
 * @name triggerInteractionAnalytics
 * @description Only use this to set interaction type on forms that have only one button.
 */
function triggerInteractionAnalytics() {
    admp_analytics_functions.updateStartEventStepNameType();
}

/**
 * @name getPagePath
 * @description Retrieves the current page path from the parent window's AbbViePageInfo object.
 * @returns {string}
 */
function getPagePath() {
    return window.AbbViePageInfo.pagepath ? window.AbbViePageInfo.pagepath : "";
}

/**
 * @name baseCreateJsonArrayForEAPICampaigns
 * @param {string} campaignKey
 * @param {object} hiddenCampaignsObj
 * @param {scope} globals
 * @return {object} form data with campaigns array
 */
function baseCreateJsonArrayForEAPICampaigns(campaignKey, hiddenCampaignsObj, globals) {
    var jsondata = globals.functions.exportData();
    var campaigns = [];
    for (var item in jsondata) {
        var campaignNo = item.split('_')[1];
        if (jsondata[campaignKey + campaignNo + '_questionid'] && jsondata[campaignKey + campaignNo + '_questiontext'] && jsondata[campaignKey + campaignNo + '_responseid'] && jsondata[campaignKey + campaignNo + '_responsetext']) {
            if (item === campaignKey + campaignNo + '_questionid') {
                var campaignInstance = {};
                campaignInstance.campaignId = jsondata[campaignKey + campaignNo + '_campaignid'];
                campaignInstance.questionId = jsondata[campaignKey + campaignNo + '_questionid'];
                campaignInstance.questionText = jsondata[campaignKey + campaignNo + '_questiontext'];
                campaignInstance.responseId = jsondata[campaignKey + campaignNo + '_responseid'];
                campaignInstance.responseText = jsondata[campaignKey + campaignNo + '_responsetext'];
                campaigns.push(campaignInstance);
            }
        }
    }

    // Instead of setting the value like this: globals.functions.setProperty(hiddenCampaignsObj, {value: JSON.stringify(campaigns)});
    // we need to directly update the form data, because setProperty function is asynchronous. So if this function is called just before form submission,
    // the updated value may not be available in time.
    let dataRef = hiddenCampaignsObj.$dataRef;
    if (dataRef.startsWith("$.")) {
        dataRef = dataRef.slice(2);
    }
    setPropertyByPath(jsondata, dataRef, campaigns);
    return jsondata;
}

/**
 * Sets a value on a nested property of an object using a dot-separated path.
 * If intermediate objects in the path do not exist, they will be created.
 *
 * @param {object} obj - The target object to modify.
 * @param {string} path - Dot-separated path specifying where to set the value.
 * @param {*} value - The value to set at the specified path.
 *
 * @example
 * const data = {};
 * setValue(data, "user.profile.name", "Alice");
 * // data => { user: { profile: { name: "Alice" } } }
 */
function setPropertyByPath(obj, path, value) {
    const keys = path.split(".");
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== "object") {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
}

/**
 * @name initSymptomSelectorSummary
 * @param {scope} globals
 */
function initSymptomSelectorSummary(globals) {
    const data = abbvSymptomSelector.getSummary();
    abbvSymptomSelector.initSummary('.abbv-symptom-selector.summary').setSummary(data);
}

/**
 * @name initSymptomSelector
 * @param {string} cssSelector
 * @param {scope} globals
 */
function initSymptomSelector(cssSelector, globals) {
    abbvSymptomSelector.init(cssSelector);
}

/**
 * Sets the brand name in the form properties that will be used in back-end submit logic.
 * @name setBrandName
 * @param {string} brandName
 */
function setBrandName(brandName) {
    window.abbviecloudforms.core.formProperties.brandName = brandName;
}

/**
 * Gets the brand name from the form properties.
 * @name getBrandName
 * @return {string}
 */
function getBrandName() {
    return window.abbviecloudforms.core.formProperties.brandName;
}

/**
 * @name baseERARGetRepDetails
 * Fetches representative details from the ERAR system and updates the UI accordingly.
 * @param {string} repId - The unique identifier for the representative.
 * @param {object} damPathObject - Object containing DAM path information for representative images.
 */

function baseERARGetRepDetails(repId, damPathObject) {
    var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
    var requestBody = {
        'getRepInfoRequest': {
            'repUPI': repId
        }
    };
    var proxyApigeeData = {
        brandName: window.guideBridge.getFormModel()._jsonModel.properties.brandName,
        payload: JSON.stringify(requestBody),
        actionType: 'Apigee',
        originName: baseDetectDeviceType(),
        version: 'V1',
        formAction: 'GetRepInfo'
    };


    var onSuccess = function (data) {
        if (data.getRepInfoResponse.isStatusSuccessful === 'true' && damPathObject) {
            var repDetails = data.getRepInfoResponse.repInfoResponse[0];
            if (repDetails !== null) {
                repPanel.visible = true;
                var repimagePath = JSON.parse(damPathObject.$value)[0] + repDetails.repUPI + JSON.parse(damPathObject.$value)[1];
                $('.repInfo .name').html(repDetails.repName);
                $('.repInfo .address').html(repDetails.city + ', ' + repDetails.state);
                $('.abbv-resonance-image').append('<img class="abbv-rep-image" src="">');
                $('.abbv-rep-image').attr('src', repimagePath);
                sessionStorage.setItem('repId', (repDetails.repUPI));
            }
        }
    };

    var onFailure = function () {
        console.error('Fail to ERAR getRepoInfo');
    };

    baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, onSuccess, onFailure);
}

/**
 * @name getTotalImpactTimeInMins
 * @return {string}
 */
function getTotalImpactTimeInMins() {
    return totalImpactTimeInMins || '';
}

/**
 * @name getTotalImpactTimeInHrs
 * @return {string}
 */
function getTotalImpactTimeInHrs() {
    return totalImpactTimeInHrs || '';
}

/**
 * @name getTotalImpactTimeInDays
 * @return {string}
 */
function getTotalImpactTimeInDays() {
    return totalImpactTimeInDays || '';
}


/**
 * @name initFragmentAnalytics
 * @param {string} analyticsPayloadValue
 * @param {string} cssSelector selector of the fragment panel
 */
function initFragmentAnalytics(analyticsPayloadValue, cssSelector) {
    analyticspayload.init(analyticsPayloadValue);
    admp_analytics_functions.updateDigitalDataObject(cssSelector);
}


/**
 * baseReplaceTags
 * @name baseReplaceTags
 * @param {object} summaryText
 * @param {scope} globals
 * @return {boolean}
 */
function baseReplaceTags(summaryText, globals) {

    var updatedText = summaryText.$value.replaceAll('<br>', '</p><p>');
    globals.functions.setProperty(summaryText, {'value': updatedText});

    return true;
}


/**
 * @name initRapidAssessmentCalculator
 * @param {object} score
 * @param {object} severity
 * @param {scope} globals
 */
function initRapidAssessmentCalculator(score, severity, globals) {

    let assessmentValueList = [];
    let assessmentRangeList = [];
    let rapid3Object = [0.3, 0.7, 1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 4.3, 4.7, 5.0, 5.3, 5.7, 6.0, 6.3, 6.7, 7.0, 7.3, 7.7, 8.0, 8.3, 8.7, 9.0, 9.3, 9.7, 10];
    guideBridge.connect(function () {
        window.guideBridge.on("elementValueChanged", function (event) {
            let component = guideBridge.resolveNode(event.detail.fieldQualifiedName);
            if (component && component._jsonModel) {
                let $element = $('#' + component._jsonModel.id).parent().parent();
                if ($element && $element.attr('class') && $element.attr('class').indexOf("abbv-quizddg-qtoken-q") !== -1) {
                    let csslist = $element.attr('class').split(" ");
                    let tokenClass = [filterKeyFromArray(csslist, 'abbv-quizddg-qtoken-q')];
                    if (csslist.indexOf("assessment-value") !== -1 || csslist.indexOf("assessment-range") !== -1) {
                        rapidAssessmentCalculatorUpdateRadio(csslist, tokenClass, event.detail.currentValue, score, severity, assessmentValueList, assessmentRangeList, rapid3Object, globals);
                    }
                } else if ($('#' + component._jsonModel.id).parents('.assessment-range').length > 0) {
                    let csslist = $('#' + component._jsonModel.id).parents('.assessment-range').eq(0).attr('class') ? $('#' + component._jsonModel.id).parents('.assessment-range').eq(0).attr('class').split(" ") : "";
                    let tokenClass = [filterKeyFromArray(csslist, 'abbv-quizddg-qtoken-q')];
                    if (csslist && csslist.indexOf("assessment-range") !== -1) {
                        rapidAssessmentCalculator(csslist, tokenClass, assessmentValueList, assessmentRangeList, score, severity, rapid3Object, globals);
                    }
                }
            }
        });
    });
}

function rapidAssessmentCalculatorUpdateRadio(csslist, tokenClass, elementValue, score, severity, assessmentValueList, assessmentRangeList, rapid3Object, globals) {
    let severityCategory = $('.severityCategoryList input')[0].value ? JSON.parse($('.severityCategoryList input')[0].value) : [];
    if (csslist && csslist.length > 0 && tokenClass.length > 0 && tokenClass[0].indexOf("abbv-quizddg-qtoken-q") !== -1) {
        if (csslist.indexOf("assessment-value") !== -1) {
            assessmentValueList[tokenClass] = parseFloat(elementValue);
        }

        let assessmentValue = 0;
        let assessmentRange = 0;
        for (let i in assessmentValueList) {
            assessmentValue += assessmentValueList[i];
        }
        for (let j in assessmentRangeList) {
            assessmentRange += assessmentRangeList[j];
        }

        let assessmentSumValue = assessmentValue > 0 ? rapid3Object[assessmentValue - 1] : 0;
        let rapidValue = (assessmentSumValue + assessmentRange);
        let severityState = rapidValue >= 0 && rapidValue < 1 ? severityCategory[0] : rapidValue >= 1 && rapidValue <= 3 ? severityCategory[1] : rapidValue > 3 && rapidValue <= 6 ? severityCategory[2] : rapidValue > 6 && rapidValue <= 12 ? severityCategory[3] : rapidValue > 12 && rapidValue <= 30 ? severityCategory[4] : "";
        console.log(rapidValue + " -------" + severityState);

        globals.functions.setProperty(score, {value: rapidValue});
        globals.functions.setProperty(severity, {value: severityState});
    }
}


function rapidAssessmentCalculator(csslist, tokenClass, assessmentValueList, assessmentRangeList, score, severity, rapid3Object, globals) {
    let severityCategory = $('.severityCategoryList input')[0].value ? JSON.parse($('.severityCategoryList input')[0].value) : [];
    if (csslist && csslist.length > 0 && tokenClass.length > 0 && tokenClass[0].indexOf("abbv-quizddg-qtoken-q") !== -1) {
        var currentInputElement = $('.ddgQuiz .' + tokenClass[0]).find("input");
        var currentDropdownElement = $('.ddgQuiz .' + tokenClass[0]).find("select");
        var conditionCheckOnDropEle = currentDropdownElement.length > 0 ? currentDropdownElement[0] : "";
        var input = currentInputElement.length > 0 ? currentInputElement : conditionCheckOnDropEle;
        if (csslist.indexOf("assessment-value") !== -1) {
            assessmentValueList[tokenClass] = parseFloat($(input)[0].value);
        } else if (csslist.indexOf("assessment-range") !== -1) {
            assessmentRangeList[tokenClass] = parseFloat($(input)[0].value);
        }
        let assessmentValue = 0;
        let assessmentRange = 0;
        for (let i in assessmentValueList) {
            assessmentValue += assessmentValueList[i];
        }
        for (let j in assessmentRangeList) {
            assessmentRange += assessmentRangeList[j];
        }
        let assessmentSumValue = assessmentValue > 0 ? rapid3Object[assessmentValue - 1] : 0;
        let rapidValue = (assessmentSumValue + assessmentRange);
        let severityState = rapidValue >= 0 && rapidValue < 1 ? severityCategory[0] : rapidValue >= 1 && rapidValue <= 3 ? severityCategory[1] : rapidValue > 3 && rapidValue <= 6 ? severityCategory[2] : rapidValue > 6 && rapidValue <= 12 ? severityCategory[3] : rapidValue > 12 && rapidValue <= 30 ? severityCategory[4] : "";
        console.log(rapidValue + " -------" + severityState);

        globals.functions.setProperty(score, {value: rapidValue});
        globals.functions.setProperty(severity, {value: severityState});
    }
}


/**
 * @name setCapsuleStrengthAndLipaseRageNew
 * @param {string} underLyingCondition
 * @param {string} ageRange
 * @param {string} selectedWeight
 * @param {object} minimumLip
 * @param {object} maximumLip
 * @param {object} dosingMatrix
 * @param {object} dropdown
 * @param {object} range
 * @param {scope} globals
 */
function setCapsuleStrengthAndLipaseRageNew(underLyingCondition, ageRange, selectedWeight, minimumLip, maximumLip, dosingMatrix, dropdown, range, globals) {
    let jsonList = JSON.parse(dosingMatrix.$value);
    globals.functions.setProperty(dropdown, {enum: [], enumNames: []});
    let tempEnum = ['0'];
    let tempEnumNames = ['Please Select '];
    let rangeArray = [];
    jsonList.forEach(function (elem, index) {
        if (elem.AGE === ageRange && elem.CONDITION === underLyingCondition && elem['WEIGHT-LB'] === parseInt(selectedWeight, 10)) {
            rangeArray.push({
                rangesnack: elem['RANGE-SNACK'],
                rangemeal: elem['RANGE-MEAL'],
                realrxmeal: elem['REALRX-MEAL'],
                realrxsnack: elem['REALRX-SNACK'],
                dispense: elem.DISPENSE,
                value: elem.CAPSULE
            });
            tempEnum.push(elem.CAPSULE + '');
            tempEnumNames.push(elem.CAPSULE.toLocaleString() + ' Lipase Unit Capsules');
            globals.functions.setProperty(minimumLip, {value: elem['MIN-LIP'].toLocaleString()});
            globals.functions.setProperty(maximumLip, {value: elem['MAX-LIP'].toLocaleString()});
        }
    });

    globals.functions.setProperty(dropdown, {enum: tempEnum, enumNames: tempEnumNames});
    globals.functions.setProperty(dropdown, {value: '0'});
    globals.functions.setProperty(range, {value: JSON.stringify(rangeArray)});
    baseSetAccordionStatus('inactive');
}

/**
 *
 * @param {object} capsuleDropdownObj
 * @param {object} perMeal
 * @param {object} perSnack
 * @param {object} RxMeal
 * @param {object} RxSnack
 * @param {object} dispenceText
 * @param {object} callOutPanel
 * @param {object} range
 * @param {scope} globals
 */
function setCapsulesCounts(capsuleDropdownObj, perMeal, perSnack, RxMeal, RxSnack, dispenceText, callOutPanel, range, globals) {
    if (capsuleDropdownObj.$value && capsuleDropdownObj.$value !== '0') {
        let callOutPanel36K = callOutPanel && callOutPanel.$parent && callOutPanel.$parent.callOutPanel36K;
        const has36000 = capsuleDropdownObj.$enum.includes("36000");
        const showCallOutPanel = has36000 && capsuleDropdownObj.$value !== "36000";
        const showCallOutPanel36K = has36000 && capsuleDropdownObj.$value === "36000";

        globals.functions.setProperty(callOutPanel, { visible: showCallOutPanel });
        if (callOutPanel36K) {
            globals.functions.setProperty(callOutPanel36K, { visible: showCallOutPanel36K });
        }
        const result = JSON.parse(range.$value).find(item => item.value === parseInt(capsuleDropdownObj.$value));

        globals.functions.setProperty(perSnack, {value: result.rangesnack});
        globals.functions.setProperty(perMeal, {value: result.rangemeal});
        globals.functions.setProperty(RxMeal, {value: result.realrxmeal});
        globals.functions.setProperty(RxSnack, {value: result.realrxsnack});

        let dText;
        if (capsuleDropdownObj.$value === '3000') {
            dText = Math.round(parseInt(result.dispense, 10) / 30) * 30;
            globals.functions.setProperty(dispenceText, {value: dText});
            const perDayCaps = Math.round(dText / 30);
            $('#caps-per-day').html(perDayCaps);
        } else {
            dText = Math.round(parseInt(result.dispense, 10) / 100) * 100;
            globals.functions.setProperty(dispenceText, {value: dText});
            const perDayCaps = Math.round(dText / 30);
            $('#caps-per-day').html(perDayCaps);
        }

        $('.rxEmptyText').empty();

        var rxScriptImageDetails = $('.rxScriptText').html();
        rxScriptImageDetails = rxScriptImageDetails.replace('${creondosingrange}', capsuleDropdownObj.$value)
            .replace('${rxmeal}', result.realrxmeal).replace('${rxsnack}', result.realrxsnack).replace('${dispense}', dText);
        $('.rxEmptyText').append(rxScriptImageDetails);
        $('.eprescribingReminderHeadingText .ePrescribingReminderBlock').remove();
        $('.emptyTextExample').empty();
        var eprescribingReminder = $('.eprescribingReminderHeadingText').html();
        eprescribingReminder = eprescribingReminder.replace('${rxmeal}', result.realrxmeal).replace('${rxsnack}', result.realrxsnack);
        $('.emptyTextExample').append(eprescribingReminder);
        baseSetAccordionStatus('active');
    } else {
        globals.functions.setProperty(perSnack, '');
        globals.functions.setProperty(perMeal, '');
        baseSetAccordionStatus('inactive');
    }
}


/**
 * @name baseSetAccordionStatus
 * @param {string} status
 */
function baseSetAccordionStatus(status) {
    let $items = $('.cmp-accordion__item');
    if (status === 'active') {
        $items.attr('data-cmp-expanded', '');
        $items.find('.cmp-accordion__button').addClass('cmp-accordion__button--expanded');
        $items.find('.cmp-accordion__button').attr('aria-expanded', 'true');
        $items.find('.cmp-accordion__panel').removeClass('cmp-accordion__panel--hidden');
        $items.find('.cmp-accordion__panel').addClass('cmp-accordion__panel--expanded');
        $items.find('.cmp-accordion__panel').attr('aria-hidden', 'false');
        $items.find('.cmp-accordion__button').css({'pointer-events': 'auto', 'opacity': '1'});
    } else if (status === 'inactive') {
        $items.removeAttr('data-cmp-expanded');
        $items.find('.cmp-accordion__button').removeClass('cmp-accordion__button--expanded');
        $items.find('.cmp-accordion__button').attr('aria-expanded', 'false');
        $items.find('.cmp-accordion__panel').addClass('cmp-accordion__panel--hidden');
        $items.find('.cmp-accordion__panel').removeClass('cmp-accordion__panel--expanded');
        $items.find('.cmp-accordion__panel').attr('aria-hidden', 'true');
        $items.find('.cmp-accordion__button').css({'pointer-events': 'none', 'opacity': '0.5'});
    }
}

/**
 * @name setInfantEPrescribingReminderText
 */
function setInfantEPrescribingReminderText() {
    baseSetAccordionStatus('active');
    let rxScriptImageDetails = $('.infantRxScriptText').html();
    rxScriptImageDetails = rxScriptImageDetails.replace('${creondosingrange}', '3000');
    $('.infantRxEmptyText').html(rxScriptImageDetails);
    let infantePrescribingReminder = $('.infantEPrescribingReminderText').html();
    infantePrescribingReminder = infantePrescribingReminder.replace('${creondosingrange}', '3000');
    $('.infantEPrescribingReminderText').remove();
    $('.infantEPrescribingReminderHeadingText').append(infantePrescribingReminder);
}


/**
 * @name getRinvoqASTotalScore
 * @param {object} q2
 * @param {object} q3
 * @param {object} q4
 * @param {object} q5
 * @param {object} q6
 * @param {scope} globals
 * @return {number}
 */
function getRinvoqASTotalScore(q2, q3, q4, q5, q6, globals) {
    let q5score;
    if (!q5.$value || q5.$value.length === 0) {
        q5score = 0;
    } else if (q5.$value.includes('13') || q5.$value.includes(13)) {
        q5score = q5.$value.length - 1;
    } else {
        q5score = q5.$value.length;
    }

    // To calculate the total score (Total score= score(Q2+Q3+Q4+(Q4*Q5)+Q6))
    // Maximum possible score = 67
    const totalScore = parseInt(q2.$value, 10) + parseInt(q3.$value, 10) + parseInt(q4.$value, 10) + parseInt(q4.$value, 10) * q5score + parseInt(q6.$value, 10);

    //To scale down the score out of 60 which is obtained for 67
    return ((totalScore / 67) * 60).toFixed(0);
}


/**
 * @name getElementsByName
 * @param {string} elementName
 * @return {*}
 */
function getElementsByName(elementName) {
    return Object.values(guideBridge.getFormModel()._fields).filter(f => f.name === elementName);
}

/**
 * @name getElementById
 * @param {string} fieldName
 * @return {*}
 */
function getElementById(fieldName) {
    const fields = Object.values(guideBridge.getFormModel()._fields).filter(f => f.id === fieldName);
    if (fields && fields.length > 0) {
        return fields[0];
    }
    return null;
}

/**
 * @name baseMatchBackSubmit
 * @param {object} wizard
 * @param {string} alreadyEnrolledUrl
 * @param {string} loginUrl
 * @param {scope} globals
 */
function baseMatchBackSubmit(wizard, alreadyEnrolledUrl, loginUrl, globals) {
    const obj = {
        FirstName: $('.AccfirstName input').val(),
        LastName: $('.AccountlastName input').val(),
        EmailAddress: $('.emailAdrress input').val()
    };
    const mainObj = {
        ConsumerLookUp: obj
    };
    const apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
    const matchBackData = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        payload: JSON.stringify(mainObj),
        actionType: 'brandAPI',
        originName: baseDetectDeviceType(),
        version: 'V1',
        formAction: 'HumiraMatchBack'
    };

    let onSuccess = function (data) {
        let errMsg = '';
        let errorList = [];
        if (data.ErrorResponseMessageList) {
            errMsg = data.ErrorResponseMessageList[0].ErrorCode;
            for (const element of data.ErrorResponseMessageList) {
                const obj = {};
                obj[element.ErrorCode] = element.ErrorMessage;
                errorList.push(obj);
            }
        }
        if (data.IsStatusSuccessful) {
            window.parent.location.href = alreadyEnrolledUrl;
        } else if (errMsg === '51033') {
            showLoader(false);
            globals.functions.setFocus(wizard, 'nextItem');
			scrollToTarget(".forms-embed", -30);
        } else if (errMsg === '59001') {
            window.parent.location.href = loginUrl;
        } else {
            showLoader(false);
            baseHandleErrorResponse(errorList, globals);
        }
    };

    let onFailure = function () {
        showLoader(false);
        handleGenericError(globals);
    };

    baseAjaxCall(apiUrl, 'POST', JSON.stringify(matchBackData), true, onSuccess, onFailure);
}

/**
 * @name initAccordionAnalytics
 * @param {scope} globals
 */
function initAccordionAnalytics(globals) {
    $('.cmp-accordion__header button.cmp-accordion__button').click(function (e) {
        const triggerAnalyticsForAccordion = function () {
            admp_analytics_functions.onFormStartEvent();
            // reset the StepName to blank
            if (window.interactionCount > 0) {
                admp_analytics_functions.setFormStepName('');
            } else {
                admp_analytics_functions.setFormStepName('init');
            }
            ++window.interactionCount;
            console.log(window.parent.digitalData.page.valueOf());
        };

        const isExpanded = this.attributes['aria-expanded'].value === 'true';
        if (isExpanded) {
            window.parent.digitalData.page.form.fieldName = $(this).children('.cmp-accordion__title').text();
            window.parent.digitalData.page.form.fieldValue = 'Collapsed';
        } else {
            window.parent.digitalData.page.form.fieldName = $(this).children('.cmp-accordion__title').text();
            window.parent.digitalData.page.form.fieldValue = 'Expanded';
        }
        triggerAnalyticsForAccordion();
    });
}

/**
 * @name mobileWalletRedirection
 * @param {scope} globals
 */
function mobileWalletRedirection(globals) {
    if (localStorage.getItem('admp_walletURLs')) {
        walletUrls = JSON.parse(localStorage.getItem('admp_walletURLs'));
        $('.wallet-btn').on('click', function () {
            window.parent.location = walletUrls.walletPassUrl;
        });
    }
}

/**
 * modalOpen
 * @name modalOpen
 */
function modalOpen() {
    $('.abbv-qPoll').removeClass('hide');
    var $focusableElements = $('.abbv-qPoll').find('button, a, input, select, textarea, [tabindex]').filter(':visible');
    var firstFocusableEle = $focusableElements[0];
    var lastFocusableEle = $focusableElements[$focusableElements.length - 1];
    if (firstFocusableEle) {
        firstFocusableEle.focus();
    }
    $('.abbv-qPoll').on('keydown', function (e) {
        if (e.which !== 9 && e.which !== 27) {
            return;
        }
        /* shift + tab */
        if (e.keyCode === 27) {
            modalClose();
        }
        if (e.shiftKey) {
            if (document.activeElement === firstFocusableEle) {
                lastFocusableEle.focus();
                e.preventDefault();
            }
        } else { /* tab */
            if (document.activeElement === lastFocusableEle) {
                firstFocusableEle.focus();
                e.preventDefault();
            }
        }
    });

    $('.modal-close').on('click', function () {
        modalClose();
    });
}

/**
 * modalClose
 * @name modalClose
 */
function modalClose() {
    $('.abbv-qPoll').addClass('hide');
}

/**
 * setModalStatus
 * Sets the value of a text input object based on modal button clicks.
 * Set "ok" or "cancel" value when respective button is clicked in the modal.
 * @name setModalStatus
 * @param {object} textInputObj - The text input object to set the value for. Value will be set to "ok" or "cancel".
 * @param {scope} globals
 */
function setModalStatus(textInputObj, globals) {
    $('#okBtn').on('click', function () {
        globals.functions.setProperty(textInputObj, {'value': 'ok'});
        modalClose();
    });
    $('#cancelBtn').on('click', function () {
        globals.functions.setProperty(textInputObj, {'value': 'cancel'});
        modalClose();
    });
}

/**
 * baseNavigateToUrlFromSamedomain
 * @name baseNavigateToUrlFromSamedomain
 * @param {String} url
 * @param {scope} globals
 */
function baseNavigateToUrlFromSamedomain(url, globals) {
    window.open(window.location.origin + url);
}

/**
 * baseValidateChildDobInHumira
 * @name baseValidateChildDobInHumira
 * @param {Object} childDob
 * @param {String} selectedIndication
 * @param {String} errMsg
 * @param {scope} globals
 * @returns {boolean}
 */
function baseValidateChildDobInHumira(childDob, selectedIndication, errMsg, globals) {
    var dob;
    var dateValue = childDob.$value;
    if (dateValue.indexOf('/') === -1) {
        dob = dateValue.slice(0, 2) + '/' + dateValue.slice(2, 4) + '/' + dateValue.slice(4, 8);
    } else {
        dob = dateValue;
    }
    var age = baseCalculateAge(new Date(dob));
    if (age < 18) {
        if (selectedIndication == '10002' && age < 6) {
            globals.functions.setProperty(date, {'errorMessage': errMsg});
            return false;
        } else if (selectedIndication == '10001' && age < 2) {
            globals.functions.setProperty(date, {'errorMessage': errMsg});
            return false;
        } else if (selectedIndication == '354' && age < 12) {
            globals.functions.setProperty(date, {'errorMessage': errMsg});
            return false;
        } else if (selectedIndication == '587' && age < 2) {
            globals.functions.setProperty(date, {'errorMessage': errMsg});
            return false;
        } else if (selectedIndication == '10666' && age < 5) {
            globals.functions.setProperty(date, {'errorMessage': errMsg});
            return false;
        } else {
            return true;
        }
    } else {
        globals.functions.setProperty(date, {'errorMessage': errMsg});
        return false;
    }
}

/**
 * Validate child DOB
 * @name baseValidateChildDobInSkyrizi
 * @param {Object} childDob  childDob INPUT field
 * @param {Object} indicationField indicationField INPUT field
 * @param {Number=} psMinAge Ps minimum age for child
 * @param {Number=} psaMinAge PsA minimum age for child
 * @param {String} minAgeErrMsg errorMsg, if child age less then minimum age
 * @param {String} errMsg error message
 * @param {Number=} legalAge
 * @param {scope} globals
 * @returns {boolean}
 */
function baseValidateChildDobInSkyrizi(childDob, indicationField, psMinAge, psaMinAge, minAgeErrMsg, errMsg, legalAge, globals) {
    if (!errMsg) {
        errMsg = 'Please enter a valid date of birth. Your child must be under 18 years old.';
    }
    if (!minAgeErrMsg) {
        minAgeErrMsg = 'Please enter a valid date of birth. Your child must be between {minAge}-18 years old.';
    }
    if (!legalAge) {
        legalAge = 18;
    }
    var dob;
    var dateValue = childDob.$value;
    if (dateValue.indexOf('/') === -1) {
        dob = dateValue.slice(0, 2) + '/' + dateValue.slice(2, 4) + '/' + dateValue.slice(4, 8);
    } else {
        dob = dateValue;
    }

    var indicationId = indicationField.$value;
    var minAge;
    if(indicationId == '6a' || indicationId == '6') {
        minAge = psMinAge; // minimum age for Ps
    } else if(indicationId == '3a' || indicationId == '3') {
        minAge = psaMinAge; // minimum age for PsA
    } else {
       minAge = 5; // default min age
    }

    var age = baseCalculateAge(new Date(dob));
    if (age >= minAge && age < legalAge) {
        return true;
    } else if(age < minAge) { // if the child age is below the minimum age
        var updatedMinAgeErrorMsg = minAgeErrMsg.replace(/\{minAge\}/g, minAge);
        globals.functions.setProperty(childDob, {'errorMessage': updatedMinAgeErrorMsg});
        return false;
    } else { // if age is greater then 18
        globals.functions.setProperty(childDob, {'errorMessage': errMsg});
        return false;
    }
}


/**
 * cancelEditedValuesInModalInHumira
 * @name cancelEditedValuesInModalInHumira
 * @param {object} namePanel
 * @param {object} informationPanel
 * @param {object} profilePanel
 * @param {object} savingsPanel
 * @param {object} editablePanel
 * @param {scope} globals
 */
function cancelEditedValuesInModalInHumira(namePanel, informationPanel, savingsPanel, editablePanel, globals) {
    $('#cancelBtn').on('click', function () {
		globals.functions.setProperty(editablePanel, {'visible': true});

        globals.functions.setProperty(globals.form.ddgQuiz.summary.summary, {'visible': false}); //reviewPanel
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.cancelbutton, {'visible': true});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.editButton, {'visible': false});

        modalClose();
    });

    $('#okBtn').on('click', function () {
        globals.functions.setProperty(editablePanel, {'visible': false});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.summary, {'visible': true});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.cancelbutton, {'visible': false});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.editButton, {'visible': true});

		var conditionSelected = globals.form.screenZero.diagnosedConditionFragmentPanel.selectYourConditionOld.$value;
        var patientOrCaregiver = informationPanel.patientorchildradiobutton.$value;
		var legalguardiancheckboxValue = informationPanel.caregiverCheckboxPanel.checkboxPanel.legalguardiancheckbox.$value;

        if (patientOrCaregiver != null ) {
            globals.functions.setProperty(editablePanel.editAdultProfilePanel, {'visible': true});
            globals.functions.setProperty(editablePanel.HSUVPanel, {'visible': true});
            globals.functions.setProperty(editablePanel.HSUVPanel.confirmPatientorchildradiobutton, {'value': informationPanel.patientorchildradiobutton.$value});
        } else {
            globals.functions.setProperty(editablePanel.editAdultProfilePanel, {'visible': false});
            globals.functions.setProperty(editablePanel.HSUVPanel, {'visible': false});
        }


        if (conditionSelected == "1" || conditionSelected == "6" || conditionSelected == "2" || conditionSelected == "4"
            || conditionSelected == "3" || conditionSelected == "5" || patientOrCaregiver == "false") {
            globals.functions.setProperty(editablePanel.editAdultProfilePanel, {'visible': true});
            globals.functions.setProperty(editablePanel.caregivercheckboxPanel, {'visible': false});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel, {'visible': false});

            /** AdultProfilePanel ***/
            globals.functions.setProperty(editablePanel.editAdultProfilePanel.confirmfirstNameTextbox, {'value': namePanel.personalDetailsPanel.AccfirstName.$value});
            globals.functions.setProperty(editablePanel.editAdultProfilePanel.confirmlastNameTextbox, {'value': namePanel.personalDetailsPanel.AccountlastName.$value});
            globals.functions.setProperty(editablePanel.editAdultProfilePanel.confirmemailAdrress, {'value': namePanel.emailAdrress.$value});

            globals.functions.setProperty(editablePanel.editAdultProfilePanel.confirmdobTextbox, {'value': informationPanel.adultprofilePanel.dobTextbox.$value});
            globals.functions.setProperty(editablePanel.editAdultProfilePanel.confirmsexRadioButton, {'value': informationPanel.adultprofilePanel.sexRadioButton.$value});
            globals.functions.setProperty(editablePanel.editAdultProfilePanel.confirmgenderidentityradiobutton, {'value': informationPanel.adultprofilePanel.genderidentityradiobutton.$value});
            globals.functions.setProperty(editablePanel.editAdultProfilePanel.confirmzipcode, {'value': informationPanel.adultprofilePanel.zipcode.$value});
            globals.functions.setProperty(editablePanel.editAdultProfilePanel.editPhoneNumberTextBox, {'value': informationPanel.adultprofilePanel.phoneNumber.$value});
            globals.functions.setProperty(editablePanel.editAdultProfilePanel.confirmmobilephonecheckbox, {'value': informationPanel.adultprofilePanel.mobilePhoneCheckbox.$value});
        }

        if (patientOrCaregiver == "true" || legalguardiancheckboxValue  == "true") {
            globals.functions.setProperty(editablePanel.caregivercheckboxPanel, {'visible': true});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel, {'visible': true});
            globals.functions.setProperty(editablePanel.editAdultProfilePanel, {'visible': false});

            globals.functions.setProperty(editablePanel.caregivercheckboxPanel.confirmlegalguardiancheckbox, {'value': informationPanel.caregiverCheckboxPanel.checkboxPanel.legalguardiancheckbox.$value});

            /** CareGiverProfilePanel ***/
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmyourfirstNameTextbox, {'value': namePanel.personalDetailsPanel.AccfirstName.$value});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmyourlastNameTextbox, {'value': namePanel.personalDetailsPanel.AccountlastName.$value});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmYourEmailAddress, {'value': namePanel.emailAdrress.$value});

            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmyourzipcode, {'value': informationPanel.accountcaregiverprofilePanel.yourzipcode.$value});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.yourPhoneNumberTextBoxOne, {'value': informationPanel.accountcaregiverprofilePanel.yourPhoneNumberTextBox.$value});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmyourmobilephonecheckbox, {'value': informationPanel.accountcaregiverprofilePanel.yourmobilephonecheckbox.$value});

            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmchildfirstNameTextbox, {'value': informationPanel.accountcaregiverprofilePanel.childfirstNameTextbox.$value});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmchildlastNameTextbox, {'value': informationPanel.accountcaregiverprofilePanel.childlastNameTextbox.$value});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmchilddobTextbox, {'value': informationPanel.accountcaregiverprofilePanel.childdobTextbox.$value});
            globals.functions.setProperty(editablePanel.editCaregiverProfilePanel.confirmchildgenderRadioButton, {'value': informationPanel.accountcaregiverprofilePanel.childgenderRadioButton.$value});
        }
        /***Insurance Type **/
        globals.functions.setProperty(editablePanel.editInsurancePanel.ConfirminsuranceType, {'value': savingsPanel.insurancePanel.insuranceType.$value});

        modalClose();
    });
}

/**
 * cancelEdititedValuesInModal
 * @name cancelEdititedValuesInModal
 * @param {object} accountPanel
 * @param {object} treatmentPanel
 * @param {object} profilePanel
 * @param {object} savingsPanel
 * @param {object} editablePanel
 * @param {scope} globals
 */
function cancelEdititedValuesInModal(accountPanel, treatmentPanel, profilePanel, savingsPanel, editablePanel, globals) {
    $('#cancelBtn').on('click', function () {
        globals.functions.setProperty(editablePanel, {'visible': true});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.summary, {'visible': false}); //reviewPanel
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.cancelbutton, {'visible': true});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.editButton, {'visible': false});


        modalClose();
    });

    $('#okBtn').on('click', function () {
        globals.functions.setProperty(editablePanel, {'visible': false});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.summary, {'visible': true});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.cancelbutton, {'visible': false});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.editButton, {'visible': true});

        globals.functions.setProperty(editablePanel.editTreatmentStarted, {'value': treatmentPanel.treatmentStartedPanel.treatmentStarted.$value});
        globals.functions.setProperty(editablePanel.editCDRecentTreatmentPanel.editCDRecentTreatment, {'value': treatmentPanel.cdRecentTreatmentPanel.cdRecentTreatment.$value});
        globals.functions.setProperty(editablePanel.editNoUpcomingTreatment, {'value': treatmentPanel.noUpcomingTreatmentPanel.noUpcomingTreatment.$value});
        globals.functions.setProperty(editablePanel.editYesUpcomingTreatment, {'value': treatmentPanel.yesUpcomingTreatmentPanel.yesUpcomingTreatment.$value});
        globals.functions.setProperty(editablePanel.editRecentTreatmentPanel.editRecentTreatment, {'value': treatmentPanel.recentTreatmentPanel.recentTreatment.$value});

        globals.functions.setProperty(editablePanel.editFirstName, {'value': accountPanel.personalDetailsPanel.AccfirstName.$value});
        globals.functions.setProperty(editablePanel.editLastName, {'value': accountPanel.personalDetailsPanel.AccountlastName.$value});
        globals.functions.setProperty(editablePanel.editEmailAddrress, {'value': accountPanel.emailAdrress.$value});

        globals.functions.setProperty(editablePanel.editDOB, {'value': profilePanel.dob.$value});
        globals.functions.setProperty(editablePanel.editSex, {'value': profilePanel.sex.$value});
        globals.functions.setProperty(editablePanel.editGender, {'value': profilePanel.genderIdentity.$value});
        globals.functions.setProperty(editablePanel.editPhoneNumber, {'value': profilePanel.phoneNumber.$value});
        globals.functions.setProperty(editablePanel.editPhoneNumberCheckbox, {'value': profilePanel.mobilePhoneCheckbox.$value});

        var mobileCheckBoxValue = profilePanel.mobilePhoneCheckbox.$value;
        if(mobileCheckBoxValue == "true"){
            globals.functions.setProperty(globals.form.ddgQuiz.summary.skyriziCompleteTextMessagesPanel.mobilePhoneNumber, {'value': profilePanel.phoneNumber.$value});
            globals.functions.setProperty(globals.form.ddgQuiz.summary.skyriziCompleteTextMessagesPanel.textMessageCheckbox, {'value': 'true'});
        }
        else{
            globals.functions.setProperty(globals.form.ddgQuiz.summary.skyriziCompleteTextMessagesPanel.mobilePhoneNumber, {'value': ''});
            globals.functions.setProperty(globals.form.ddgQuiz.summary.skyriziCompleteTextMessagesPanel.textMessageCheckbox, {'value': 'false'});
        }

        globals.functions.setProperty(editablePanel.editInsuranceType, {'value': savingsPanel.insurancePanel.insuranceType.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editStreetAddress, {'value': savingsPanel.addressPanel.streetAddressTextbox.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editStreetAddress2, {'value': savingsPanel.addressPanel.streetAddress2Textbox.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editCity, {'value': savingsPanel.addressPanel.cityTextbox.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editState, {'value': savingsPanel.addressPanel.stateDropdown.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editZipcode, {'value': savingsPanel.addressPanel.addressZipCode1.$value});

        modalClose();
    });
}

/**
 * cancelEdititedValuesInModalPed
 * @name cancelEdititedValuesInModalPed
 * @param {object} accountPanel
 * @param {object} treatmentPanel
 * @param {object} treatmentPanelPaediatric
 * @param {object} profilePanel
 * @param {object} savingsPanel
 * @param {object} editablePanel
 * @param {scope} globals
 */
function cancelEdititedValuesInModalPed(accountPanel, treatmentPanel, treatmentPanelPaediatric, profilePanel, savingsPanel, editablePanel, globals) {
    $('#cancelBtn').on('click', function () {
        globals.functions.setProperty(editablePanel, {'visible': true});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.summary, {'visible': false}); //reviewPanel
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.cancelbutton, {'visible': true});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.editButton, {'visible': false});


        modalClose();
    });

    $('#okBtn').on('click', function () {
        globals.functions.setProperty(editablePanel, {'visible': false});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.summary, {'visible': true});
		globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.cancelbutton, {'visible': false});
        globals.functions.setProperty(globals.form.ddgQuiz.summary.editCancelPanel.editButton, {'visible': true});

		if(treatmentPanel.treatmentStartedPanel.treatmentStarted.$value) { // non-pediatric patient
                globals.functions.setProperty(editablePanel.patientTreatmentDetail.editTreatmentStarted, {'value': treatmentPanel.treatmentStartedPanel.treatmentStarted.$value});
                globals.functions.setProperty(editablePanel.patientTreatmentDetail.editCDRecentTreatmentPanel.editCDRecentTreatment, {'value': treatmentPanel.cdRecentTreatmentPanel.cdRecentTreatment.$value});
                globals.functions.setProperty(editablePanel.patientTreatmentDetail.editNoUpcomingTreatment, {'value': treatmentPanel.noUpcomingTreatmentPanel.noUpcomingTreatment.$value});
                globals.functions.setProperty(editablePanel.patientTreatmentDetail.editYesUpcomingTreatment, {'value': treatmentPanel.yesUpcomingTreatmentPanel.yesUpcomingTreatment.$value});
                globals.functions.setProperty(editablePanel.patientTreatmentDetail.editRecentTreatmentPanel.editRecentTreatment, {'value': treatmentPanel.recentTreatmentPanel.recentTreatment.$value});
		} else { // Updated changes for the paediatric patients (pediatric plaque psoriasis and juvenile psoriatic arthritis )
                globals.functions.setProperty(editablePanel.paediatricPatientTreatmentDetail.editTreatmentStartedPediatric, {'value': treatmentPanelPaediatric.treatmentStartedPediatric.$value});
                globals.functions.setProperty(editablePanel.paediatricPatientTreatmentDetail.editNoUpcomingPaediatricTreatmentPanel.editNoUpcomingPaediatricTreatment, {'value': treatmentPanelPaediatric.noUpcomingPaediatricTreatmentPanel.noUpcomingPaediatricTreatment.$value});
                globals.functions.setProperty(editablePanel.paediatricPatientTreatmentDetail.editRecentTreatmentPaediatricPanel1.editRecentPediatricTreatment, {'value': treatmentPanelPaediatric.recentTreatmentPanel.recentTreatmentPediatric.$value});
                globals.functions.setProperty(editablePanel.paediatricPatientTreatmentDetail.editRecentTreatmentPaediatricPanel1.editRecentTreatmentPediatricOn, {'value': treatmentPanelPaediatric.recentTreatmentPanel.recentTreatmentPediatricOn.$value});
                globals.functions.setProperty(editablePanel.paediatricPatientTreatmentDetail.editChildFirstName, {'value': profilePanel.paediatricInfo.childFirstName.$value});
                globals.functions.setProperty(editablePanel.paediatricPatientTreatmentDetail.editChildLastName, {'value': profilePanel.paediatricInfo.childLastName.$value});
                globals.functions.setProperty(editablePanel.paediatricPatientTreatmentDetail.editChildDOB, {'value': profilePanel.paediatricInfo.childDOB.$value});
                globals.functions.setProperty(editablePanel.paediatricPatientTreatmentDetail.editChildsSex, {'value': profilePanel.paediatricInfo.childsSex.$value});

		}

        globals.functions.setProperty(editablePanel.editFirstName, {'value': accountPanel.personalDetailsPanel.AccfirstName.$value});
        globals.functions.setProperty(editablePanel.editLastName, {'value': accountPanel.personalDetailsPanel.AccountlastName.$value});
        globals.functions.setProperty(editablePanel.editEmailAddrress, {'value': accountPanel.emailAdrress.$value});

        globals.functions.setProperty(editablePanel.editDOB, {'value': profilePanel.dob.$value});
        globals.functions.setProperty(editablePanel.editSex, {'value': profilePanel.sex.$value});
        globals.functions.setProperty(editablePanel.editGender, {'value': profilePanel.genderIdentity.$value});
        globals.functions.setProperty(editablePanel.editPhoneNumber, {'value': profilePanel.phoneNumber.$value});
        globals.functions.setProperty(editablePanel.editPhoneNumberCheckbox, {'value': profilePanel.mobilePhoneCheckbox.$value});


		
		var mobileCheckBoxValue = profilePanel.mobilePhoneCheckbox.$value;
		if(mobileCheckBoxValue == "true"){
			globals.functions.setProperty(globals.form.ddgQuiz.summary.skyriziCompleteTextMessagesPanel.mobilePhoneNumber, {'value': profilePanel.phoneNumber.$value});
			globals.functions.setProperty(globals.form.ddgQuiz.summary.skyriziCompleteTextMessagesPanel.textMessageCheckbox, {'value': 'true'});
		}
		else{
			globals.functions.setProperty(globals.form.ddgQuiz.summary.skyriziCompleteTextMessagesPanel.mobilePhoneNumber, {'value': ''});
			globals.functions.setProperty(globals.form.ddgQuiz.summary.skyriziCompleteTextMessagesPanel.textMessageCheckbox, {'value': 'false'});
		}

        globals.functions.setProperty(editablePanel.editInsuranceType, {'value': savingsPanel.insurancePanel.insuranceType.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editStreetAddress, {'value': savingsPanel.addressPanel.streetAddressTextbox.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editStreetAddress2, {'value': savingsPanel.addressPanel.streetAddress2Textbox.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editCity, {'value': savingsPanel.addressPanel.cityTextbox.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editState, {'value': savingsPanel.addressPanel.stateDropdown.$value});
        globals.functions.setProperty(editablePanel.editAddressPanel.editZipcode, {'value': savingsPanel.addressPanel.addressZipCode1.$value});
		function setFieldValue(source, target) {
		    if (source && target && source.$value) {
		        globals.functions.setProperty(target, {
		            'value': source.$value
		        });
		    }
		}

		setFieldValue(
		    treatmentPanel.cdRecentTreatmentPanel && treatmentPanel.cdRecentTreatmentPanel.treatmentStartRadiobuttonYes,
		    editablePanel.patientTreatmentDetail && editablePanel.patientTreatmentDetail.edittreatmentStartRadiobuttonYes
		);

		setFieldValue(
		    treatmentPanel.cdRecentTreatmentPanel1 && treatmentPanel.cdRecentTreatmentPanel1.treatmentStartRadiobuttonNo,
		    editablePanel.patientTreatmentDetail && editablePanel.patientTreatmentDetail.edittreatmentStartRadiobuttonNo
		);

		setFieldValue(
		    treatmentPanel.gastroIVInfusionOption,
		    editablePanel.patientTreatmentDetail && editablePanel.patientTreatmentDetail.editGastroIVInfusionOption
		);

		setFieldValue(
		    treatmentPanel.gastroOBIInfusionOption,
		    editablePanel.patientTreatmentDetail && editablePanel.patientTreatmentDetail.editGastroOBIInfusionOption
		);
        modalClose();
    });
}


/**
 * Function to get the display text (enumName) of a selected dropdown option.
 * @param {object} fieldName - The name of your dropdown field.
 * @returns {string | null} The display text of the selected option, or null if none is selected.
 */

function getDisplayFieldText(fieldName) {
    return fieldName.$enumNames[fieldName.$enum.indexOf(fieldName.$value)] || null;
}

/**
 * Load Abbvie Access Unsubcribe Details
 * @name baseLoadAbbvUnsubscribeDetails
 * @param {string} [fid] query string,optional
 * @param {string} [cfid] query strings,optional
 * @param {object} unsubscribepanel
 * @param {string} token
 * @param {scope} globals
 */
function baseLoadAbbvUnsubscribeDetails(fid, cfid, unsubscribepanel, token, globals) {
    if (baseUrlGetParam(fid)) {
        baseGetAbbvUnsubscribeDetails(fid, unsubscribepanel, token, globals);
    } else if (baseUrlGetParam(cfid)) {
        baseGetAbbvUnsubscribeDetails(cfid, unsubscribepanel, token, globals);
    }
}


/**
 * Get Abbvie Access Unsubcribe Details
 * @name baseGetAbbvUnsubscribeDetails
 * @param {string} [fid] query string,optional
 * @param {object} unsubscribepanel
 * @param {string} token
 * @param {scope} globals
 */
function baseGetAbbvUnsubscribeDetails(fid, unsubscribepanel, token, globals) {
    var expId = baseUrlGetParam(fid);
    if (expId !== '' || expId !== null) {
        var token;
        if (baseUrlGetParam(token)) {
            token = baseUrlGetParam(token);
        }
        baseGetExposureDetails(expId, unsubscribepanel, token, globals);
    }
}

/**
 * Get Abbvie Access Unsubcribe Details
 * @name baseLoadPrefCenter
 * @param {string} updpreferenceclassname
 * @param {object} redirecturl
 * @param {string} preference_center
 * @param {string} abbvHide
 * @param {scope} globals
 */
function baseLoadPrefCenter(updpreferenceclassname, redirecturl, preference_center, abbvHide, globals) {
    window.parent.document.querySelector('.' + updpreferenceclassname).style.display = 'none';
    var $pref_center = window.parent.document.getElementById(preference_center);
    $pref_center.setAttribute('src', redirecturl.$value);
    $pref_center.classList.remove(abbvHide);
}

/**
 * setSessionCookie
 * @name setSessionCookie
 * @param {string} name
 * @param {object} value
 */
function setSessionCookie(name, value) {
    document.cookie =
        encodeURIComponent(name) + "=" + encodeURIComponent(value) +
        ";path=/" +
        ";Secure";
}

/**
 * @name fileUploadCanProceed
 * @param {scope} globals
 * @return {boolean}
 */
function fileUploadCanProceed(globals) {
    return abbvFileUpload.canProceed();
}


/**
 * @name baseHDSRegistrationMatchBack
 * @param {object} wizard
 * @param {string} samlRedirectPath
 * @param {string} matchBackModalCssSelector
 * @param {object} emailField
 * @param {string} errMsg
 * @param {object} captchaErrorMsg
 * @param {scope} globals
 */
function baseHDSRegistrationMatchBack(wizard, samlRedirectPath, matchBackModalCssSelector, emailField, errMsg, captchaErrorMsg, globals) {
    getEnterpriseToken('MatchBack').then(function (token){

     $.ajax({
        url: "/bin/abbvieforms/api/okta",
        method: 'post',
        async: false,
        data: {
            brandName: window.abbviecloudforms.core.formProperties.brandName,
            formaction: "MatchBack",
            version: window.abbviecloudforms.core.formProperties.version,
            userName: emailField.$value,
            data: emailField.$value,
            captchaToken: token
        }
    }).done(function (response) {
    // CAPTCHA FAILURE
        if (response && response.error === true && (response.errorCode === "CAPTCHA_FAILED" || response.errorCode === "CAPTCHA_MISSING")) {
            globals.functions.setProperty(captchaErrorMsg, {visible: true});
            globals.functions.setFocus(wizard, 'prevItem');
            return;
        }
        if (response && response.success) {
            if (response.successResponse) {
                console.info(" HCP success------- Registration not allowed  ::  ");
                window.abbvModal.openModal(matchBackModalCssSelector);
                setCookie('saml_request_path=' + samlRedirectPath, true, 7 * 60 * 60);
            } else if (response.successResponse === false) {
                console.log(" New user pls continue registration ");
                globals.functions.setFocus(wizard, 'nextItem');
            }
        } else {
            globals.functions.setProperty(emailField, {valid: false});
            globals.functions.setProperty(emailField, {errorMessage: errMsg});
            globals.functions.setFocus(wizard, 'prevItem');
        }
    }).fail(function (){
        console.error("Ajax request to matchback failed for HCP Registration.");
     });
  });
}

/**
 * Exchanges an Okta recoveryToken for an Okta stateToken
 * @name baseOktaRecoveryToken
 * @param {string} recoveryToken
 * @param {object} recoveryTokenFormPanel
 * @param {object} stateTokenTextbox
 * @param {string} brandName
 * @param {string} apiVersion
 * @param {scope} globals
 */
function baseOktaRecoveryToken(recoveryToken, recoveryTokenFormPanel, stateTokenTextbox, brandName, apiVersion, globals) {
    const dataInfo = {data: {recoveryToken: recoveryToken}};
    $.ajax({
        url: "/abbviecloud/bin/abbvieforms/api/okta/recoverytoken",
        method: "post",
        async: false,
        data: {
            brandName: brandName,
            version: apiVersion,
            data: JSON.stringify(dataInfo)
        }

    }).done(function (response) {
        if (response.stateToken) {
            console.info(" success  ::  " + response.stateToken);
            globals.functions.setProperty(stateTokenTextbox, {value: response.stateToken});
            globals.functions.setProperty(stateTokenTextbox, {visible: true});
        } else {
            handleGenericError(globals);
            globals.functions.setProperty(stateTokenTextbox, {visible: false});
        }
    }).fail(function (error) {
        console.error("Ajax request to authenticate failed.");
    });
}

/*Method for phone number Formatter*/
/**
 * baseFormatPhoneNumber
 * @name baseFormatPhoneNumber
 * @param {string} phoneNumber
 */
function baseFormatPhoneNumber(phoneNumber) {
    var phoneNumberFormat = phoneNumber && phoneNumber.replace( /[^0-9]/g, '' );
    phoneNumberFormat = phoneNumberFormat && phoneNumberFormat.replace(/(\d{3})\-?(\d{3})\-?(\d{4})/,'$1-$2-$3');
    return phoneNumberFormat;
}

/**
 * Validate that a value is numeric (integer or decimal, greater than or equal to 0)
 * @name validateDecimals
 * @param {object} element - The element to apply the restriction on.
 */
function validateDecimals(element) {
    const jqueryElement = $('#' + element.$id + '-widget');
    jqueryElement.on('propertychange input', function () {
        const updateValue = jqueryElement.val().replace(/^\d*\.?\d+$/, '');
        jqueryElement.val(updateValue);
    });
}

/**
 * Validate that a value is numeric (integer or decimal, greater than or equal to 0)
 * @param {String|Number} field
 * @returns true if valid (also true if null or '' is passed???)
 */
function baseValidateDecimal(field) {
    if (field) {
        return /^\d*\.?\d+$/.test(field);
    }
    return true;
}

/**
 *
 * @param {string} formelementname
 * @param {string | number} fieldValue
 */
function setAnalyticsPayloadFieldValue(formelementname, fieldValue) {
    payloadFieldObj.formfields.find(el => el.formelementname === formelementname).payloadfieldvalue = fieldValue;
}


/**
 * hidePlaceHolderFromDropdown
 * @name hidePlaceHolderFromDropdown
 * @param {string} classname
 */
function hidePlaceHolderFromDropdown(classname) {
    $('.'+classname+ " option:disabled").remove();
}

/**
 * @name validateRateValHigh
 * @param {object} infsnRate
 * @param {object} baseRate
 * @param {object} highInfusionRate
 * @param {scope} globals
 * @return {boolean}
 */
function validateRateValHigh(infsnRate, baseRate, highInfusionRate, globals) {
    const regExp = new RegExp('^(\\d+(\\.\\d{0,2})?|\\.?\\d{1,2})$');
    if (!infsnRate || !regExp.test(infsnRate.$value)) {
        globals.functions.setProperty(infsnRate, {errorMessage: 'Please enter a value in increments of 0.01.'});
        return false;
    }
    const infsnRateVal = parseFloat(infsnRate.$value).toFixed(2);
    if (infsnRateVal < baseRate.$value) {
        globals.functions.setProperty(infsnRate, {errorMessage: 'Please enter a value greater than or equal to the current hourly infusion rate.'});
        return false;
    } else {
        globals.functions.setProperty(highInfusionRate, {value: infsnRateVal});
        return true;
    }
}

/**
 * @name validateRateValLow
 * @param {object} infsnRate
 * @param {object} baseRate
 * @param {object} lowInfusionRate
 * @param {scope} globals
 * @return {boolean}
 */
function validateRateValLow(infsnRate, baseRate, lowInfusionRate, globals) {
    const regExp = new RegExp('^(\\d+(\\.\\d{0,2})?|\\.?\\d{1,2})$');
    if (!infsnRate || !regExp.test(infsnRate.$value)) {
        globals.functions.setProperty(infsnRate, {errorMessage: 'Please enter a value in increments of 0.01.'});
        return false;
    }
    const infsnRateVal = parseFloat(infsnRate.$value).toFixed(2);
    if (infsnRateVal > baseRate.$value) {
        globals.functions.setProperty(infsnRate, {errorMessage: 'Please enter a value less than or equal to the current hourly infusion rate.'});
        return false;
    } else {
        globals.functions.setProperty(lowInfusionRate, {value: infsnRateVal});
        return true;
    }
}

/**
 * Function to get image from localStorage based on key
 * @param {Object} fieldName - Target field
 * @param {String} storageKey - localStorage key (dynamic)
 */
function getProductImage(fieldName, storageKey) {
    let imagePath = localStorage.getItem(storageKey);
    fieldName._jsonModel.value = imagePath;
}

/**
 * @name restrictNumberOfDigitsInNumericComponent
 * @param {String} targetClass
 * @param {number} numberOfDigits
 * @param {boolean} [restrictNegativeNumber=false] - When true restrict negative numbers
 * @param {scope} globals
 */
function restrictNumberOfDigitsInNumericComponent(targetClass, numberOfDigits, restrictNegativeNumber, globals) {	
        var numeric_field = document.querySelector('.' + targetClass + ' input');
        numeric_field.addEventListener("input", function(e) {
            let value = this.value;
            if (restrictNegativeNumber && value.includes('-')) {
                this.value = value.replace(/-+/g, '');
            }
            if (value.length > numberOfDigits) {
                this.value = value.slice(0, numberOfDigits);
            }
        });
        numeric_field.addEventListener("blur", function(e) {
            let value = this.value;
            if (restrictNegativeNumber && value.includes('-')) {
                this.value = value.replace(/-+/g, '');
            }

        });
        numeric_field.addEventListener("keydown", function(e) {
            let value = this.value;
            if (restrictNegativeNumber && e.key === '-') {
                e.preventDefault();
            }
        });
}
/**
 * Gets the value of an html text.
 * $(selector).text();
 * @param {string} selector the selector to find the element(s), e.g. .firstname
 */
function getValueOfHtmlText(selector) {
    return $(selector).text();
}

/**
 * Function to get the input field display value
 * @param {Object} fieldName - Target field
 */
function getFieldDisplayValue(fieldName) {
    return fieldName.$displayValue || "";
}

/**
 * name - baseValidateStrikeIron
 * @param {object} email
 * @param {string} errMsg
 * @returns {boolean}
 */
function baseValidateStrikeIron(email, errMsg){
	showLoader(true);
	var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
	var jsonModel = window.abbviecloudforms.core.formProperties;
    var emailValue = email &&  email.$value ? email.$value : '';
	var payload =  {
      	"validateEmailRequest": {
            "emailAddress": emailValue,
            "websiteId": 19
     	}
    }

	var proxyPayload = {
		brandName: jsonModel.brandName,
		actionType: 'Apigee',
		originName: baseDetectDeviceType(),
		payload: JSON.stringify(payload),
		requestType: 'POST',
		version: 'V1',
		formAction: 'StrikeIronValidation'
	};

	baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyPayload), false, onSuccess, onFailure);

	function onSuccess(data) {
		showLoader(false);
		if(data && data.validateEmailResponse) {
			if(!data.validateEmailResponse.isValid){
				$('input[name ="emailAddress"]').addClass('strikeironerror');
                errMsg && globals.functions.setProperty(email, {'errorMessage': errMsg});
			   return false;
			}else{
				return true;
			}
		}
		return false;
	}

	function onFailure(error) {
		showLoader(false);
		return false;
	}
}

/**
 * @name setCopayCardToLocalStorage
 * @param {scope} globals
 */
function setCopayCardToLocalStorage(globals) {
    var response = globals.event.payload.body;
    if (!response || !response.metadata || !response.metadata.FormSubmitInfo) {
        return;
    }

    var formSubmitInfo = response.metadata.FormSubmitInfo;
    var rxBIN = formSubmitInfo.match(/RxBIN=([^,}]+)/);
    var rxPCN = formSubmitInfo.match(/RxPCN=([^,}]+)/);
    var rxGroup = formSubmitInfo.match(/RxGroup=([^,}]+)/);
    var rxIdentifier = formSubmitInfo.match(/RxIdentifier=([^,}]+)/);
    var suf = formSubmitInfo.match(/Suf=([^,}]+)/);
    var copayCard = {
        rxBIN: rxBIN ? rxBIN[1] : "",
        rxPCN: rxPCN ? rxPCN[1] : "",
        rxGroup: rxGroup ? rxGroup[1] : "",
        rxIdentifier: rxIdentifier ? rxIdentifier[1] : "",
        Suf: suf ? suf[1] : ""
    };
    localStorage.removeItem("admp_cci");
    localStorage.setItem("admp_cci", JSON.stringify(copayCard));
}

/**
 * @name humiraDecryptSavingsCard
 */
function humiraDecryptSavingsCard() {
setTimeout(function () {
    // First name & copay Details
    var firstName = localStorage.getItem("First_Name");
    var storedCopayCard = localStorage.getItem("admp_cci");

    if (!storedCopayCard && !firstName) {
        return;
    }
    var coPayResult;
    try {
       coPayResult = JSON.parse(storedCopayCard);
    } catch (e) {
       console.error("Unable to parse admp_cci from localStorage", e);
        return;
    }

    if(coPayResult) {
        coPayResult.rxBIN ? $('.rxbin').text(coPayResult.rxBIN) : '';
        coPayResult.rxPCN ? $('.rxpcn').text(coPayResult.rxPCN) : '';
        coPayResult.rxGroup ? $('.rxgroup').text(coPayResult.rxGroup) : '';
        coPayResult.rxIdentifier ? $('.rxidentifer').text(coPayResult.rxIdentifier) : '';
    }
    // Set first name
    firstName ? $('.humira-patient-first-name').text(firstName) : '';
    }, 1000);
}

/**
 * Validates the lookup panel and retrieves HCP data based on the provided NPI number.
 * @param {object} npiNumberComponent
 * @param {object} lookUpPanel
 * @param {object} repPanel
 * @param {object} metadataPanel
 * @param {scope} globals
 */
function validatePanelAndGetHCPbyNPI(npiNumberComponent, lookUpPanel, repPanel, metadataPanel, globals) {
    showLoader(true);
    if (validatePanel(lookUpPanel, globals)) {
        baseGetHCPByNPI(npiNumberComponent, lookUpPanel, repPanel, metadataPanel, globals);
    } else {
        hideLoader();
    }
    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);
}

/**
 * Validates the lookup panel and retrieves HCP data based on the provided NPI number.
 * @param {object} npiNumberComponent
 * @param {object} lookUpPanel
 * @param {object} repPanel
 * @param {object} metadataPanel
 * @param {string} formPanel string representing the form panel
 * @param {object} iAmRadioButton
 * @param {object} checkboxGroupPanel
 * @param {object} errorMessageObject
 * @param {scope} globals
 */
function validateEpkinlyHCPRadioPanelAndGetHCPbyNPI(npiNumberComponent, lookUpPanel, repPanel, metadataPanel,
                                                    formPanel, iAmRadioButton, checkboxGroupPanel, errorMessageObject, globals) {
    let validationFailed = validateDsaRegCheckboxGroup(checkboxGroupPanel, errorMessageObject, globals);
    let iAmRadioButtonValue = iAmRadioButton.$value;

    showLoader(true);
    if (validatePanel(lookUpPanel, globals) && !validationFailed) {
        if (iAmRadioButtonValue === '1') {
            globals.functions.setProperty(repPanel, {visible: true});
            globals.functions.setProperty(lookUpPanel, {visible: false});
            hideLoader();
        } else if (iAmRadioButtonValue === '0') {
            baseGetHCPByNPI(npiNumberComponent, lookUpPanel, repPanel, metadataPanel, globals);
        }
    } else {
        hideLoader();
    }
    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);
}

/**
 * Validates the lookup panel and retrieves HCP data based on the provided NPI number.
 * @param {object} npiNumberComponent
 * @param {object} lookUpPanel
 * @param {object} repPanel
 * @param {object} metadataPanel
 * @param {string} formPanel string representing the form panel
 * @param {object} degree
 * @param {object} checkboxGroupPanel
 * @param {object} errorMessageObject
 * @param {scope} globals
 */
function validateEpkinlyHCPDegreePanelAndGetHCPbyNPI(npiNumberComponent, lookUpPanel, repPanel, metadataPanel,
                                                     formPanel, degree, checkboxGroupPanel, errorMessageObject, globals) {
    let validationFailed = validateDsaRegCheckboxGroup(checkboxGroupPanel, errorMessageObject, globals);
    let degreeValue = degree.$value;

    showLoader(true);
    if (validatePanel(lookUpPanel, globals) && !validationFailed) {
        if (degreeValue === 'MD' || degreeValue === 'DO' || degreeValue === 'NP' || degreeValue === 'PA') {
            baseGetHCPByNPI(npiNumberComponent, lookUpPanel, repPanel, metadataPanel, globals);
        } else if (degreeValue === 'RN' || degreeValue === 'RPh/PharmD') {
            globals.functions.setProperty(repPanel, {visible: true});
            globals.functions.setProperty(lookUpPanel, {visible: false});
            hideLoader();
        }
    } else {
        hideLoader();
    }
    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);
}

/**
 * @name baseGetHCPByNPI
 * @description This function retrieves HCP data based on the provided NPI number.
 *
 * Posts to the captcha validating proxy for every caller, not just the forms that authored
 * captchaProxyEnabled, so the NPI lookup is gated wherever it is reached from - swagger-contact-rep
 * (Request FRM), hcp-registration-marketo and apigee-hds-hcp-registration (Epkinly). A caller whose
 * page cannot mint a token falls back to the legacy proxy and is not gated - see resolveProxyApiUrl.
 * @param {object} npiNumberComponent the component containing the NPI number as its value.
 * @param {object} lookUpPanel the panel where the lookup is performed.
 * @param {object} repPanel the panel where the representative information is displayed that will be populated with HCP data.
 * @param {object} metadataPanel the panel containing metadata information.
 * @param {scope} globals the global scope containing the form and functions.
 */
function baseGetHCPByNPI(npiNumberComponent, lookUpPanel, repPanel, metadataPanel, globals) {
    var HCPDataFromNPI = [];
    var payload = {};
    payload.npi_id = npiNumberComponent.$value;
    var proxyApigeeData = {
        brandName: window.guideBridge.getFormModel()._jsonModel.properties.brandName,
        payload: JSON.stringify(payload),
        actionType: 'ApigeeHDS',
        originName: baseDetectDeviceType(),
        formAction: 'EnterpriseHCPLookupByNPI',
        version: 'V1',
        formRequest: 'Yes'
    };

    var baseGetHCPCallbackFailure = function (error) {
        hideLoader();
        console.error('Error in fetching NPI', error);
    };

    var baseERARGetHCPCallbackSuccess = function (data) {
        if (isCaptchaValidationFailure(data)) {
            hideLoader();
            handleCaptchaValidationFailure(globals);
            return;
        }
        /* This is the first of the two ERAR calls. The submit step calls execute() again, which
           mints a fresh token on its own - nothing to discard here. */
        if (data && data.status === 'SUCCESS' && data.content && data.content.length) {
            HCPDataFromNPI = data.content;
            baseERARPrefillHCPDataFromNPI(HCPDataFromNPI, repPanel, lookUpPanel, metadataPanel, globals);
        } else {
            globals.functions.setProperty(npiNumberComponent, {valid: false});
            globals.functions.setProperty(npiNumberComponent, {'errorMessage': npiNumberComponent._jsonModel.constraintMessages.validationExpression});
        }
        hideLoader();
    };

    if (window.location.hostname === 'localhost' || window.location.hostname.includes('adobeaemcloud.com')) {
        baseERARGetHCPCallbackSuccess(mockNPIData);
    } else {
        getEnterpriseToken(proxyApigeeData.formAction).then(function (token) {
            /* No token means captcha is unavailable on this page - fall back to the legacy proxy so
               the lookup still works, ungated. See resolveProxyApiUrl. */
            var apiUrl = resolveProxyApiUrl(token);
            if (token) {
                proxyApigeeData.admpInvisibleCaptchaData = token;
            }
            baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, baseERARGetHCPCallbackSuccess, baseGetHCPCallbackFailure);
        });
    }

}

function baseERARPrefillHCPDataFromNPI(HCPDataFromNPI, repPanel, hcpLookupPanel, metadataPanel, globals) {
    var hcpDataFormNpi = HCPDataFromNPI[0];
    if (HCPDataFromNPI.length) {
        globals.functions.setProperty(repPanel.FirstName, {value: hcpDataFormNpi.first_name || ''});
        if (hcpDataFormNpi.first_name) {
            globals.functions.setProperty(repPanel.FirstName, {enabled: false});
        }
        globals.functions.setProperty(repPanel.LastName, {value: hcpDataFormNpi.last_name || ''});
        if (hcpDataFormNpi.last_name) {
            globals.functions.setProperty(repPanel.LastName, {enabled: false});
        }

        if ('OfficePhoneNumber' in (repPanel || {})) {
            globals.functions.setProperty(repPanel.OfficePhoneNumber, {value: hcpDataFormNpi.phone || ''});
        }
        if ('emailAddress' in (repPanel || {})) {
            globals.functions.setProperty(repPanel.emailAddress, {value: hcpDataFormNpi.email || ''});
        }
        if ('addressLine1' in (repPanel.visitPanel || {})) {
            globals.functions.setProperty(repPanel.visitPanel.addressLine1, {value: hcpDataFormNpi.address_line_1 || ''});
        }
        if ('addressLine2' in (repPanel.visitPanel || {})) {
            globals.functions.setProperty(repPanel.visitPanel.addressLine2, {value: hcpDataFormNpi.address_line_2 || undefined});
        }
        if ('city' in (repPanel.visitPanel || {})) {
            globals.functions.setProperty(repPanel.visitPanel.city, {value: hcpDataFormNpi.city || ''});
        }
        if ('state' in (repPanel.visitPanel || {})) {
            globals.functions.setProperty(repPanel.visitPanel.state, {value: hcpDataFormNpi.state || ''});
        }
        if ('zipcode' in (repPanel.visitPanel || {})) {
            globals.functions.setProperty(repPanel.visitPanel.zipcode, {value: hcpDataFormNpi.zip || ''});
        }
        if ('hcpid' in (metadataPanel.hidden_fields_panel || {})) {
            globals.functions.setProperty(metadataPanel.hidden_fields_panel.hcpid, {value: hcpDataFormNpi.hcp_id || ''});
        }
        if ('nameOfPractice' in (repPanel.visitPanel || {})) {
            globals.functions.setProperty(repPanel.visitPanel.nameOfPractice, {value: hcpDataFormNpi.practiceName || ''});
        } else if ('nameOfPractice' in (repPanel || {})) {
            globals.functions.setProperty(repPanel.nameOfPractice, {value: hcpDataFormNpi.practiceName || ''});
        }
        if ('acid' in (metadataPanel.hidden_fields_panel || {})) {
            globals.functions.setProperty(metadataPanel.hidden_fields_panel.acid, {value: hcpDataFormNpi.hcp_id || ''});
        }
        globals.functions.setProperty(repPanel, {visible: true});
        globals.functions.setProperty(hcpLookupPanel, {visible: false});
    }
}

function baseAjaxCall(api_url, type, payload, asyncType, successCallbackFunction, failureCallbackFunction) {
    var requestObject = {
        url: api_url,
        method: type,
        async: asyncType,
        data: payload,
        contentType: 'application/json'
    };

    $.ajax(requestObject).done(
        function (response) {
            successCallbackFunction(response);
        }).fail(function (error) {
        console.log(error.message);
        failureCallbackFunction(error);
    });
}

function showNPIErrorMessage() {
    $('.successPanel .successText').html('').hide();
    $('.npiTextbox').first().removeClass('validation-success').addClass('validation-failure');
    $('.npiTextbox .cmp-adaptiveform-textinput__errormessage')
        .css({'visibility': 'visible'})
        .html($('.abbv-hcpnotfound-error').html())
        .show();
}

/**
 * @name baseHCPSubmitAction
 * @description Step 2 of the ERAR flow, and the FAS submission. Posts to the captcha validating
 * proxy for every caller, the same as the NPI lookup in baseGetHCPByNPI, falling back to the legacy
 * proxy - ungated - when the page cannot mint a token. See resolveProxyApiUrl.
 * @param actionType
 * @param {scope} globals
 */
function baseHCPSubmitAction(actionType, globals) {
    const validations = globals.functions.validate();
    if (validations.length === 0 || (validations.length === 1 && validations[0].fieldName && validations[0].fieldName.includes('recaptcha'))) {
        showLoader(true);
        var jsondata = globals.functions.exportData();
        var proxyApigeeData = {
            brandName: window.abbviecloudforms.core.formProperties.brandName,
            actionType: 'ApigeeHDS',
            originName: baseDetectDeviceType(),
            version: 'V1',
            formRequest: 'Yes',
        };

        var baseERARHCPSubmitSuccess = function (response) {
            if (isCaptchaValidationFailure(response)) {
                showLoader(false);
                handleCaptchaValidationFailure(globals);
                return;
            }
            handleResponseActionERAR(response, jsondata.EnterpriseRarRequest, globals);
        };

        var baseHCPSubmitActionFailure = function (response, globals) {
            baseHCPSubmitFailure(response, globals)
        };

        if (actionType === 'ERAR') {
            var payload = jsondata.EnterpriseRarRequest;
            var notesObj = {
                brand: payload.productName,
                nameOfPractice: payload.nameOfPractice,
                address1: payload.address.line1,
                address2: payload.address.line2,
                city: payload.address.city,
                state: payload.address.state,
                officeZipCode: payload.address.zipCode,
                officePhoneNumber: payload.phoneNumber,
                emailAddress: payload.emailAddress,
                optIn: payload.optIn
            }
            if (payload.dayToContact) {
                notesObj.bestDayToContact = payload.dayToContact;
            } else {
                notesObj.bestDayToContact = "";
            }

            if (payload.timeToContact) {
                notesObj.bestTimeToContact = payload.timeToContact;
            } else {
                notesObj.bestTimeToContact = "";
            }

            if (payload.modeOfContact) {
                notesObj.contactChannel = payload.modeOfContact;
            }

            if (payload.reasonsForContact) {
                notesObj.reasonForContact = payload.reasonsForContact.toString();
                payload.reasonsForContact = payload.reasonsForContact.toString();
            }

            payload.combinedNotes = baseERARReplaceNotesTokens(payload.combinedNotes, notesObj);
            payload.firstName = globals.form.contactARep.ContactAREPPanel.FirstName.$value;
            payload.lastName = globals.form.contactARep.ContactAREPPanel.LastName.$value;

            proxyApigeeData.payload = JSON.stringify(payload);
            proxyApigeeData.formAction = 'EnterpriseHCPRequestARep';
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('adobeaemcloud.com')) {
                baseERARHCPSubmitSuccess(mockERARHCPResponse);
            } else {
                getEnterpriseToken(proxyApigeeData.formAction).then(function (token) {
                    /* No token means captcha is unavailable on this page - fall back to the legacy
                       proxy so the submit still works, ungated. See resolveProxyApiUrl. */
                    var apiUrl = resolveProxyApiUrl(token);
                    if (token) {
                        proxyApigeeData.admpInvisibleCaptchaData = token;
                    }
                    baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, baseERARHCPSubmitSuccess, baseHCPSubmitActionFailure);
                });
            }
        }
    }

    var baseFASHCPSubmitSuccess = function (response) {
        if (isCaptchaValidationFailure(response)) {
            showLoader(false);
            handleCaptchaValidationFailure(globals);
            return;
        }
        handleResponseActionFAS(response, jsondata.FASRequest, globals);
    };

    if (actionType === 'FAS') {
        jsondata.FASRequest.firstName = globals.form.contactARep.ContactAREPPanel.FirstName.$value;
        jsondata.FASRequest.lastName = globals.form.contactARep.ContactAREPPanel.LastName.$value;
        proxyApigeeData.payload = JSON.stringify(jsondata.FASRequest);
        proxyApigeeData.formAction = 'FASRequest';
        getEnterpriseToken(proxyApigeeData.formAction).then(function (token) {
            /* No token means captcha is unavailable on this page - fall back to the legacy proxy so
               the submit still works, ungated. See resolveProxyApiUrl. */
            var apiUrl = resolveProxyApiUrl(token);
            if (token) {
                proxyApigeeData.admpInvisibleCaptchaData = token;
            }
            baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, baseFASHCPSubmitSuccess, baseHCPSubmitActionFailure);
        });
    }
}

/**
 * @name baseHCPSubmitActionVenclextaCaseBasedDiscussion
 * @param {string} actionType
 * @param {scope} globals
 */
function baseHCPSubmitActionVenclextaCaseBasedDiscussion(actionType, globals) {
    showLoader(true);
    var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
    var jsondata = globals.functions.exportData();
    var proxyApigeeData = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        actionType: 'ApigeeHDS',
        originName: baseDetectDeviceType(),
        version: 'V1',
        formRequest: 'Yes',
    };

    var baseERARHCPSubmitSuccess = function (response) {
        handleResponseAction(response, jsondata.EnterpriseRarRequest, globals);
    };

    var baseHCPSubmitActionFailure = function (response, globals) {
        baseHCPSubmitFailure(response, globals)
    };

    if (actionType === 'ERAR') {
        var payload = jsondata.EnterpriseRarRequest;
        let notesObj = {
            hcpNameOne: globals.form.contactARep.ContactAREPPanel.FirstName.$value + ' ' + globals.form.contactARep.ContactAREPPanel.LastName.$value,
            hcpNameTwo: globals.form.contactARep.ContactAREPPanel.FirstName.$value + ' ' + globals.form.contactARep.ContactAREPPanel.LastName.$value,
            hcpNameThree: globals.form.contactARep.ContactAREPPanel.FirstName.$value + ' ' + globals.form.contactARep.ContactAREPPanel.LastName.$value,
            reasonForContact: payload.reasonsForContact.toString(),
            contactChannel: payload.modeOfContact,
            brand: payload.productName,
            optin: payload.optIn,
            officePhoneNumber: payload.phoneNumber,
            emailAddress: payload.emailAddress
        };

        payload.combinedNotes = baseERARReplaceNotesTokens(payload.combinedNotes, notesObj);
        payload.firstName = globals.form.contactARep.ContactAREPPanel.FirstName.$value;
        payload.lastName = globals.form.contactARep.ContactAREPPanel.LastName.$value;

        proxyApigeeData.payload = JSON.stringify(payload);
        proxyApigeeData.formAction = 'EnterpriseHCPRequestARep';
        if (window.location.hostname === 'localhost' || window.location.hostname.includes('adobeaemcloud.com')) {
            baseERARHCPSubmitSuccess(mockERARHCPResponse);
        } else {
            baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, baseERARHCPSubmitSuccess, baseHCPSubmitActionFailure);
        }
    }

    var baseFASHCPSubmitSuccess = function (response) {
        handleResponseAction(response, jsondata.FASRequest, globals);
    };

    if (actionType === 'FAS') {
        proxyApigeeData.payload = JSON.stringify(jsondata.FASRequest);
        proxyApigeeData.formAction = 'FASRequest';
        baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyApigeeData), true, baseFASHCPSubmitSuccess, baseHCPSubmitActionFailure);
    }
}

function handleResponseAction(response, jsondata, globals) {
    if (response && response.status === 'SUCCESS') {
        window.parent.digitalData.page.form.stepName = 'submit';
        if (analyticspayload.validPayload) {
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent(jsondata);
        }
        var emailAdd = $('.email-address').find('input').val();
        let emailAddCust;
        if (jsondata.emailAddress) {
            emailAddCust = jsondata.emailAddress;
        } else if (jsondata.email) {
            emailAddCust = jsondata.email;
        } else {
            emailAddCust = '';
        }
        var pagePath = window.parent.AbbViePageInfo ? window.parent.AbbViePageInfo.pagepath : '';

        var hcpLookupPanel = globals.form.contactARep;
        passDDGQuestionsFromQuizPanel(hcpLookupPanel);
        generateEmailPayloadHCP(emailAdd, pagePath, true);
        try {
            if (emailAddCust) {
                generateEmailPayloadHCP(emailAdd, pagePath, false, true);
                generateDdgQuizEmail(emailAddCust, 'ddg', pagePath, false);
            }
        } catch (error) {
            console.log('Error in sending email');
        }
        //validates and redirect to thankyou page
        baseURLRedirection(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl, globals);
    } else {
        var errorCode = response.errors[0].code;
        if ((errorCode === '10002' || errorCode === '10010' || errorCode === '10017')) {
            admp_analytics_functions.onFormSubmitError(response);
            baseHandleHDSErrorResponse(response, globals);
        } else {
            baseHCPSubmitFailure(response, globals);
        }
    }
    showLoader(false);
}

function generateEmailPayloadHCP(emailAdd, pagePath, status, emailIdentifier) {
    var path = pagePath;
    finalPayload["type1"] = JSON.stringify(updatePayload(ddgType1, status));
    finalPayload["type2"] = ddgType2;
    finalPayload["totalTimeDays"] = totalImpactTimeInDays;
    finalPayload["totalTimeHours"] = totalImpactTimeInHrs;
    var emailSelector = $(".email-address");
    finalPayload["emailAddress"] = emailSelector.find('input').val() ? emailSelector.find('input').val() : "";
    finalPayload["pagePath"] = path ? path : "";
    if (emailIdentifier) {
        var customerIdentifierSelector = $(".customer-identifier");
        finalPayload["emailIdentifier"] = customerIdentifierSelector.find('input').val() ? customerIdentifierSelector.find('input').val() : "";
    }
}

function baseHCPSubmitFailure(resp, globals) {
    var myArray = window.parent.AbbViePageInfo.runModes.split(',');
    var emailAdd;
    if (myArray[0] === 'prod') {
        emailAdd = $('.email-address').find('input').val();
    } else {
        emailAdd = "kana@mailinator.com";
    }
    var emailAddCust = $('.email-customer').find('input').val();
    var pagePath = window.parent.AbbViePageInfo ? window.parent.AbbViePageInfo.pagepath : '';
    admp_analytics_functions.onFormSubmitError(resp);
    if (resp.errors && resp.errors.length) {
        $('.abbv-api-responseStatus').find('textarea').val(resp.errors[0].code + '-' + resp.errors[0].message);
    }

    var hcpLookupPanel = globals.form.contactARep;
    passDDGQuestionsFromQuizPanel(hcpLookupPanel);
    try {
        if (emailAdd.trim()) {
            generateEmailPayloadHCP(emailAdd, pagePath, false);
            generateDdgQuizEmail(emailAdd, 'ddg', pagePath, false);
        }
        if (emailAddCust) {
            generateEmailPayloadHCP(emailAdd, pagePath, false, true);
            generateDdgQuizEmail(emailAddCust, 'ddg', pagePath, false);
        }
    } catch (error) {
        console.error('Error in sending email');
    }
    //validates and redirect to thankyou page
    baseURLRedirection(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl, globals);
    showLoader(false);
}

function baseERARReplaceNotesTokens(notesStr, notesObj) {
    if (notesStr) {
        for (var key in notesObj) {
            notesStr = notesStr.replace(`{{${key}}}`, notesObj[key] || '');
        }
    }
    return notesStr;
}

/**
 * baseHcpCaptureSubmitAction
 * @name baseHcpCaptureSubmitAction
 * @param {object} surveyGroup
 * @param {scope} globals
 */
function baseHcpCaptureSubmitAction(surveyGroup, globals) {
    baseCreateJsonArrayForSurveyPayload(surveyGroup, globals);

    let jsonData = globals.functions.exportData();
    const errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, jsonData);
    }
}

/**
 * baseHcpCaptureSubmitSuccessHandler
 * @name baseHcpCaptureSubmitSuccessHandler
 * @param {scope} globals
 */
function baseHcpCaptureSubmitSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    let response = globals.event.payload.body;
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    let formSubmitInfo = JSON.parse(jsonString.replace(/(\w+)=(\w+)/g, '"$1":"$2"'));

    if (formSubmitInfo.status === 'SUCCESS') {
        if (analyticspayload.validPayload) {
            analyticspayload.getFormCompletePayload();
        } else {
            let jsonData = globals.functions.exportData();
            analyticsFormSubmitEvent(jsonData.HcpCaptureRequest);
        }
        baseHcpSendMail('success', globals);
        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl);
    }
}

/**
 * baseHcpCaptureSubmitErrorHandler
 * @name baseHcpCaptureSubmitErrorHandler
 * @param {scope} globals
 */
function baseHcpCaptureSubmitErrorHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);
    let errorObj = Array.isArray(errorList) && errorList.length > 0 ? errorList[0] : {};
    if (errorObj.status === 'ERROR') {
        admp_analytics_functions.onFormSubmitError(errorList);
        delete errorList[0].status;

        if ('10005' in errorObj) {
            baseSubmitReset();
            handleFieldError(errorList, globals);
        } else {
            baseHcpSendMail('failure', globals);
            //failure thank you page
            //validates and redirect to thankyou page
            redirectToThankYouPage(window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl);
        }
    } else {
        baseHandleErrorResponse(errorList, globals);
    }
}

function baseHandleHDSErrorResponse(response, globals) {
    showLoader(false);
    baseSubmitReset();
    let errorList = [];
    if (response && response.errors) {
        //This is response.errors '[{"errorCode":"BAD_REQUEST","code":"10002","message":"Invalid zip"}]'
        //Need to transform to this: [{"10002":"Invalid zip"}]'
        for (let i = 0; i < response.errors.length; i++) {
            let obj = {};
            obj[response.errors[i].code] = response.errors[i].message;
            errorList.push(obj);
        }
    }
    if (errorList && errorList.length) {
        handleFieldError(errorList, globals);
    }
}

function baseHcpSendMail(status, globals) {
    let pagePath = window.parent.AbbViePageInfo ? window.parent.AbbViePageInfo.pagepath : '';
    let emailAddresses = $("input[name='emailAddress_" + status + "']").val() || '';
    let emailIdentifier = $("input[name='emailIdentifier_" + status + "']").val() || '';
    if (emailAddresses.trim() && emailIdentifier.trim()) {
        passDDGQuestionsFromQuizPanel(globals.form.contactARep);
        generateHCPPayload(emailAddresses, pagePath, false, emailIdentifier);
        generateDdgQuizEmail(emailAddresses, 'ddg', pagePath, false);
    }
}

/* Function to generate payload for email and pdf for HDS HCP using ddq-quiz tokens */
function generateHCPPayload(emailAdd, pagePath, status, emailIdentifier) {
    finalPayload.type1 = JSON.stringify(updatePayload(ddgType1, status));
    finalPayload.type2 = ddgType2;
    finalPayload.totalTimeDays = totalImpactTimeInDays;
    finalPayload.totalTimeHours = totalImpactTimeInHrs;
    finalPayload.emailAddress = emailAdd || '';
    finalPayload.pagePath = pagePath || '';
    finalPayload.emailIdentifier = emailIdentifier || '';
}

function baseHandleErrorResponse(errorList, globals) {
    baseSubmitReset();
    if (errorList && errorList.length) {
        handleFieldError(errorList, globals);
    } else {
        handleGenericError(globals);
    }
}

/**
 * baseSwaggerFDMSubmitAction
 * @name baseSwaggerFDMSubmitAction
 * @param {string} formType - The type of the form being submitted
 * @param {object} textBoxSom - The text box component for the SOM
 * @param {scope} globals
 */
function baseSwaggerFDMSubmitAction(formType, textBoxSom, globals) {
    let jsonData = globals.functions.exportData();
    if (formType === 'speakerProgramRegistration') {
        requestBody = jsonData.SpeakerProgram;
    } else if (formType === 'SaveAssessmentContent') {
        requestBody = jsonData.SaveAssessmentContent;
    } else if (formType === 'HCPRegistrationMarketo') {
        requestBody = jsonData.HcpMarketoRegistrationRequest;
    } else if (formType === 'StaffRegistration') {
        requestBody = jsonData.StaffRegistrationRequest;
    }

    const errors = globals.functions.validate();
    if (errors.length === 0 ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $('.submit.button button').prop('disabled', true);
        fetchObservabilityAndSubmit(globals, requestBody)

        guideBridge.on("elementEnableChanged", function (event, payload) {
            var component = payload.target; // Field whose value has changed
            if (component.name == globals.form.showStep3PanelTextbox.name) {
                globals.form.thankyouPanel.visible = true;
                globals.form.hcpRegistrationPanel.visible = false;
            }
        });
    }
}

/**
 * baseSwaggerFDMSuccessHandler
 * @name baseSwaggerFDMSuccessHandler
 * @param {object} tyPanel
 * @param {object} hcpRegistrationPanel
 * @param {scope} globals
 */
function baseSwaggerFDMSuccessHandler(tyPanel, hcpRegistrationPanel, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    let response = globals.event.payload.body;
    const jsonString = globals.event.payload.body.metadata.FormSubmitInfo;
    let formSubmitInfo = JSON.parse(jsonString.replace(/(\w+)=(\w+)/g, '"$1":"$2"'));
    if (formSubmitInfo.IsStatusSuccessful) {
        if (analyticspayload.validPayload) {
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent(requestBody);
        }
        //validates and redirect to thankyou page
        baseURLRedirection(response.data.thankYouPageURL);
    } else if (formSubmitInfo.status === 'SUCCESS') {
        window.parent.digitalData.page.form.stepName = 'submit';
        baseApigeeSuccessAction(response);
        if (tyPanel) {
            globals.functions.setProperty(tyPanel, {visible: true});
        }
        if (hcpRegistrationPanel) {
            globals.functions.setProperty(hcpRegistrationPanel, {visible: false});
        }
    }
}

/**
 * baseSwaggerFDMErrorHandler
 * @name baseSwaggerFDMErrorHandler
 * @param {string} formType - The type of the form being submitted
 * @param {scope} globals
 */
function baseSwaggerFDMErrorHandler(formType, globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    let errorResponse = globals.event.payload.body;
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);
    let errorObj = Array.isArray(errorList) && errorList.length > 0 ? errorList[0] : {};

    if (errorObj.status === 'ERROR') {
        admp_analytics_functions.onFormSubmitError(errorList);
        delete errorList[0].status;

        if (formType === 'HCPRegistrationMarketo') {
            if ('10005' in errorObj || '10006' in errorObj) {
                baseSubmitReset();
                handleFieldError(errorList, globals);
            } else {
                //send mail
                baseHCPSubmitFailure(errorResponse, globals);
            }
        } else {
            // other then HCP
            admp_analytics_functions.onFormSubmitError(errorResponse);
            baseHandleHDSErrorResponse(errorResponse);
        }

    } else {
        admp_analytics_functions.onFormSubmitError(errorResponse);
        baseHandleErrorResponse(errorList, globals);
    }
}

function baseApigeeSuccessAction(response) {
    if (response.systemReference && response.systemReference.length > 0) {
        var sysRef = response.systemReference[0];
        if (sysRef.id && window.parent.digitalData && window.parent.digitalData.user[0].profile[0].id) {
            window.parent.digitalData.user[0].profile[0].id.prmID = sysRef.id;
            console.log(window.parent.digitalData.user[0].profile[0].id);
        }
    }
    if (analyticspayload.validPayload) {
        analyticspayload.getFormCompletePayload();
    } else {
        analyticsFormSubmitEvent();
    }
}

function baseHandleHCPErrorResponse(response) {
    baseSubmitReset();
    var errorList = '';
    if (response && response.errors) {
        errorList = response.errors;
    }
    var globalError = true;
    if (errorList.length) {
        var $errorLabel = $('.err--label');
        $errorLabel.hide();
        $('.generic-error-message').hide();
        for (var i = 0; i < errorList.length; i++) {
            var errorCode = errorList[i].code || '';
            var errorMessage = errorList[i].message || '';
            if ((errorCode === '10005' || errorCode === '10006')) {
                // do not send e-mail
                baseHDSShowChildAndGlobalLevelError($errorLabel, errorCode, errorMessage, globalError);
            } else
                //send mail
            {
                baseHCPSubmitFailure(response);
            }
        }
    }
}

function baseHDSShowChildAndGlobalLevelError(response, globals) {
    baseSubmitReset();
    var errorList = '';
    if (response && response.errors) {
        errorList = response.errors;
    }
    if (errorList && errorList.length) {
        handleFieldError(errorList, globals);
    }
}

/**
 * createNotesTextMavyretRequestARep
 * @description This function creates notes text for Mavyret Request A Rep form.
 * @param {object} combinedNotesTextField - The combined notes text field component.
 * @param {scope} globals - The global scope containing the form and functions.
 */
function createNotesTextMavyretRequestARep(combinedNotesTextField, globals) {
    var hcpLookupPanel = combinedNotesTextField.parent.parent.HcpLookupPanel;
    var contactArepPanel = combinedNotesTextField.parent;

    var notesObj = {
        reasonForContact: hcpLookupPanel.reasonForContact.$value,
        contactChannel: contactArepPanel.HowLikeToContact.$value,
        brand: contactArepPanel.brandNameTextField.$value,
        optin: contactArepPanel.optInCheckbox.value,
        nameOfPractice: contactArepPanel.visitPanel.nameOfPractice.value,
        address1: contactArepPanel.visitPanel.mailingAddress.value,
        address2: contactArepPanel.visitPanel.addressLine1.value,
        city: contactArepPanel.visitPanel.city.value,
        state: contactArepPanel.visitPanel.state.value,
        officeZipCode: contactArepPanel.visitPanel.zipcode.value,
        officePhoneNumber: contactArepPanel.OfficePhoneNumber.value,
        emailAddress: contactArepPanel.emailAddres.value,
        bestDayToContact: contactArepPanel.phonePanel.BestDay.value,
        bestTimeToContact: contactArepPanel.phonePanel.BestTime.value
    };

    var notesText = baseERARReplaceNotesTokens(combinedNotesTextField.$value, notesObj);
    globals.functions.setProperty(combinedNotesTextField, {value: notesText});
}
function handleResponseActionFAS(response, jsondata, globals) {
    if (response && response.status === 'SUCCESS') {
        window.parent.digitalData.page.form.stepName = 'submit';
        if (analyticspayload.validPayload) {
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent(jsondata);
        }
        var emailAdd = $('.email-address').find('input').val();
        let emailAddCust;
        if (jsondata.emailAddress) {
            emailAddCust = jsondata.emailAddress;
        } else if (jsondata.email) {
            emailAddCust = jsondata.email;
        } else {
            emailAddCust = '';
        }
        var pagePath = window.parent.AbbViePageInfo ? window.parent.AbbViePageInfo.pagepath : '';

        var hcpLookupPanel = globals.form.contactARep;
        passDDGQuestionsFromQuizPanel(hcpLookupPanel);
        generateEmailPayloadHCP(emailAdd, pagePath, true);
        try {
            if (emailAddCust) {
                generateEmailPayloadHCP(emailAdd, pagePath, false, true);
                generateDdgQuizEmail(emailAddCust, 'ddg', pagePath, false);
            }
        } catch (error) {
            console.log('Error in sending email');
        }
        //validates and redirect to thankyou page
        baseURLRedirection(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl, globals);
    } else {
        var errorCode = response.errors[0].code;
		let configuredCodes = [];
		if (
		    globals.form.metadata_panel &&
		    globals.form.metadata_panel.hidden_fields_panel &&
		    globals.form.metadata_panel.hidden_fields_panel.errorcodes &&
		    globals.form.metadata_panel.hidden_fields_panel.errorcodes.$value
		) {
		    configuredCodes = globals.form.metadata_panel.hidden_fields_panel.errorcodes.$value
		        .split(",")
		        .map(function(code) {
		            return code.trim();
		        });
		}
        let fallbackCodes = ['10002', '10010', '10017'];
        if ((configuredCodes || fallbackCodes).includes(errorCode)) {
            admp_analytics_functions.onFormSubmitError(response);
            baseHandleHDSErrorResponse(response, globals);
        } else {
            baseHCPSubmitFailure(response, globals);
        }
    }
    showLoader(false);
}

function handleResponseActionERAR(response, jsondata, globals) {
    if (response && response.status === 'SUCCESS') {
        window.parent.digitalData.page.form.stepName = 'submit';
        if (analyticspayload.validPayload) {
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent(jsondata);
        }
        var emailAdd = $('.email-address').find('input').val();
        let emailAddCust;
        if (jsondata.emailAddress) {
            emailAddCust = jsondata.emailAddress;
        } else if (jsondata.email) {
            emailAddCust = jsondata.email;
        } else {
            emailAddCust = '';
        }
        var pagePath = window.parent.AbbViePageInfo ? window.parent.AbbViePageInfo.pagepath : '';

        var hcpLookupPanel = globals.form.contactARep;
        passDDGQuestionsFromQuizPanel(hcpLookupPanel);
        generateEmailPayloadHCP(emailAdd, pagePath, true);
        try {
            if (emailAddCust) {
                generateEmailPayloadHCP(emailAdd, pagePath, false, true);
                generateDdgQuizEmail(emailAddCust, 'ddg', pagePath, false);
            }
        } catch (error) {
            console.log('Error in sending email');
        }
        //validates and redirect to thankyou page
        baseURLRedirection(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl, globals);
    } else {
        var errorCode = response.errors[0].code;
		let configuredCodes = [];
		if (
		    globals.form.metadata_panel &&
		    globals.form.metadata_panel.hidden_fields_panel &&
		    globals.form.metadata_panel.hidden_fields_panel.errorcodes &&
		    globals.form.metadata_panel.hidden_fields_panel.errorcodes.$value
		) {
		    configuredCodes = globals.form.metadata_panel.hidden_fields_panel.errorcodes.$value
		        .split(",")
		        .map(function(code) {
		            return code.trim();
		        });
		}
        let fallbackCodes = ['10002', '10010', '10017'];
        if ((configuredCodes || fallbackCodes).includes(errorCode)) {
            admp_analytics_functions.onFormSubmitError(response);
            baseHandleHDSErrorResponse(response, globals);
        } else {
            baseHCPSubmitFailure(response, globals);
        }
    }
    showLoader(false);
}
var generateDDGQuiz = [];
var payload = {};
var totalImpactTimeInMins = 0, totalImpactTimeInHrs = 0, totalImpactTimeInDays = 0, summaryObject = [], ddgType1 = [],
    ddgType2 = {}, finalPayload = {};
payload = finalPayload;

/**
 * Functions to generate Email
 * @name ddgQuizSendEmail DDG Quiz Send Email
 * @param {object} email
 * @param {object} [emailSuccessPanel] success panel will be visible after email is sent, if no redirect is triggered, optional
 * @param {object} [sendNowButton] button to send email, will be hidden after email is sent, optional
 * @param {object} [recaptcha] recaptcha object, will be hidden after email is sent, optional
 * @param {scope} globals
 **/
function ddgQuizSendEmail(email, emailSuccessPanel, sendNowButton, recaptcha, globals) {
    const validations = globals.functions.validate();
    if (validations.length === 0) {
        const emailAdd = email.$value ? email.$value : $(".email-address").find('input').val();
        window.parent.AbbViePageInfo = window.parent.AbbViePageInfo || {};
        let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
        passDDGQuestionsFromQuizPanel(globals.form.ddgQuiz);
        const data = abbvSymptomSelector.getSummary();
        generatePayloadSymptoms(data, pagePath, "email");
        generateDdgQuizEmail(emailAdd, "ddg", pagePath, true, email, emailSuccessPanel, sendNowButton, recaptcha, globals);
        onSubmitCompleteAnalytics(globals);
        redirectToThankYouPage(window.abbviecloudforms.core.formProperties.thankyoupageurl);
    }
}

/**
 * Functions to generate Email
 * @name ddgQuizSendEmailWithoutRedirect DDG Quiz Send Email without redirect
 * @param {object} email
 * @param {object} [emailSuccessPanel] success panel will be visible after email is sent, if no redirect is triggered, optional
 * @param {object} [sendNowButton] button to send email, will be hidden after email is sent, optional
 * @param {object} [recaptcha] recaptcha object, will be hidden after email is sent, optional
 * @param {scope} globals
 **/
function ddgQuizSendEmailWithoutRedirect(email, emailSuccessPanel, sendNowButton, recaptcha, globals) {
    ddgQuizSendEmailWithoutRedirectExtended(email, emailSuccessPanel, sendNowButton, recaptcha, null, null, globals);
}

/**
 * Functions to generate Email
 * @name ddgQuizSendEmailWithoutRedirectNoAnalytics DDG Quiz Send Email without redirect and without analytics
 * @param {object} email
 * @param {object} [emailSuccessPanel] success panel will be visible after email is sent, if no redirect is triggered, optional
 * @param {object} [sendNowButton] button to send email, will be hidden after email is sent, optional
 * @param {object} [recaptcha] recaptcha object, will be hidden after email is sent, optional
 * @param {scope} globals
 **/
function ddgQuizSendEmailWithoutRedirectNoAnalytics(email, emailSuccessPanel, sendNowButton, recaptcha, globals) {
    ddgQuizSendEmailWithoutRedirectExtendedNoAnalytics(email, emailSuccessPanel, sendNowButton, recaptcha, null, null, globals);
}

/**
 * Functions to generate Email
 * @name ddgQuizSendEmailWithoutRedirectExtended
 * @param {object} email
 * @param {object} [emailSuccessPanel] success panel will be visible after email is sent, if no redirect is triggered, optional
 * @param {object} [sendNowButton] button to send email, will be hidden after email is sent, optional
 * @param {object} [recaptcha] recaptcha object, will be hidden after email is sent, optional
 * @param {object} [pdfPanel] pdf panel object, will be hidden after email is sent, optional
 * @param {object} [summaryPanel] summary panel object, will be hidden after email is sent, optional
 * @param {scope} globals
 **/
function ddgQuizSendEmailWithoutRedirectExtended(email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals) {
    const validations = globals.functions.validate();
    if (validations.length === 0) {
        const emailAdd = email.$value ? email.$value : $(".email-address").find('input').val();
        window.parent.AbbViePageInfo = window.parent.AbbViePageInfo || {};
        let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
        passDDGQuestionsFromQuizPanel(globals.form.ddgQuiz);
        const data = abbvSymptomSelector.getSummary();
        generatePayloadSymptoms(data, pagePath, "email");
        generateDdgQuizEmailExtended(emailAdd, "ddg", pagePath, true, email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals);
        onSubmitCompleteAnalytics(globals);
    }
}

/**
 * Functions to generate Email without analytics
 * @name ddgQuizSendEmailWithoutRedirectExtendedNoAnalytics
 * @param {object} email
 * @param {object} [emailSuccessPanel] success panel will be visible after email is sent, if no redirect is triggered, optional
 * @param {object} [sendNowButton] button to send email, will be hidden after email is sent, optional
 * @param {object} [recaptcha] recaptcha object, will be hidden after email is sent, optional
 * @param {object} [pdfPanel] pdf panel object, will be hidden after email is sent, optional
 * @param {object} [summaryPanel] summary panel object, will be hidden after email is sent, optional
 * @param {scope} globals
 **/
function ddgQuizSendEmailWithoutRedirectExtendedNoAnalytics(email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals) {
    const validations = globals.functions.validate();
    if (validations.length === 0) {
        const emailAdd = email.$value ? email.$value : $(".email-address").find('input').val();
        window.parent.AbbViePageInfo = window.parent.AbbViePageInfo || {};
        let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
        passDDGQuestionsFromQuizPanel(globals.form.ddgQuiz);
        const data = abbvSymptomSelector.getSummary();
        generatePayloadSymptoms(data, pagePath, "email");
        generateDdgQuizEmailExtended(emailAdd, "ddg", pagePath, true, email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals);
    }
}


/**
 * Functions to generate Email
 * @description Function to send email without built-in validation and without redirect.
 * @name ddgQuizSendEmailWithoutRedirectExtendedAndValidation
 * @param {object} email
 * @param {object} [emailSuccessPanel] success panel will be visible after email is sent, if no redirect is triggered, optional
 * @param {object} [sendNowButton] button to send email, will be hidden after email is sent, optional
 * @param {object} [recaptcha] recaptcha object, will be hidden after email is sent, optional
 * @param {object} [pdfPanel] pdf panel object, will be hidden after email is sent, optional
 * @param {object} [summaryPanel] summary panel object, will be hidden after email is sent, optional
 * @param {scope} globals
 **/
function ddgQuizSendEmailWithoutRedirectExtendedAndValidation(email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals) {
    const emailAdd = email.$value ? email.$value : $(".email-address").find('input').val();
    window.parent.AbbViePageInfo = window.parent.AbbViePageInfo || {};
    let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
    passDDGQuestionsFromQuizPanel(globals.form.ddgQuiz);
    const data = abbvSymptomSelector.getSummary();
    generatePayloadSymptoms(data, pagePath, "email");
    generateDdgQuizEmailExtended(emailAdd, "ddg", pagePath, true, email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals);
    onSubmitCompleteAnalytics(globals);
}


/**
 * Functions to download pdf
 * @name ddgQuizDownloadPdf
 *
 * @param {object} sendNowButton
 * @param {object} [email] email input field, optional
 * @param {scope} globals
 **/
function ddgQuizDownloadPdf(sendNowButton, email, globals) {
    var emailAdd = "";
    if (email && !email.$value && !$(".email-address").find('input').val()) {
        emailAdd = email.$value ? email.$value : $(".email-address").find('input').val();
    }
    window.parent.AbbViePageInfo = window.parent.AbbViePageInfo || {};
    let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
    passDDGQuestions(globals);
    const data = abbvSymptomSelector.getSummary();
    generatePayloadSymptoms(data, pagePath);
    pdfQuizDDGAnswers(emailAdd, "basequizddgpdf", pagePath, sendNowButton);
    admp_analytics_functions.analyticsFormInteractionEvent(sendNowButton);
}

/**
 * Functions to download pdf with identifier
 * @name ddgQuizDownloadPdfWithIdentifier
 *
 * @param {object} sendNowButton
 * @param {string} identifier identifies the pdf
 * @param {object} [email] email input field, optional
 * @param {scope} globals
 **/
function ddgQuizDownloadPdfWithIdentifier(sendNowButton, identifier, email, globals) {
    var emailAdd = "";
    if (email && !email.$value && !$(".email-address").find('input').val()) {
        emailAdd = email.$value ? email.$value : $(".email-address").find('input').val();
    }
    window.parent.AbbViePageInfo = window.parent.AbbViePageInfo || {};
    let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
    passDDGQuestions(globals);
    const data = abbvSymptomSelector.getSummary();
    generatePayloadSymptoms(data, pagePath);
    pdfQuizDDGAnswersWithIdentifier(emailAdd, "basequizddgpdf", pagePath, sendNowButton, identifier);
    admp_analytics_functions.analyticsFormInteractionEvent(sendNowButton);
}

/**
 * Function to pass DDG quiz questions.
 * @name passDDGQuestions
 * @param {scope} globals
 * @description Iterates through quiz question elements and generates DDG quiz objects.
 */
function passDDGQuestions(globals) {
    var ddgQuizForm = globals.form.ddgQuiz;
    ddgQuizForm.$items.forEach(step => {
        if (step.$name !== 'summary') {
            var questions = $('#' + step.$id)
                .find('[class*="abbv-quizddg-qtoken-q"]')
                .filter(function () {
                    return /abbv-quizddg-qtoken-q\d+\b/.test(this.className);
                });
            $(questions).each(function (index, question) {
                generateDDgQuizObject(question);
            });
        }
    });
}

/**
 * Function to pass DDG quiz questions. Will use values instead of labels for question summary.
 * @name passDDGQuestionsUseValues
 * @param {scope} globals
 * @description Iterates through quiz question elements and generates DDG quiz objects.
 */
function passDDGQuestionsUseValues(globals) {
    var ddgQuizForm = globals.form.ddgQuiz;
    ddgQuizForm.$items.forEach(step => {
        if (step.$name !== 'summary') {
            var questions = $('#' + step.$id)
                .find('[class*="abbv-quizddg-qtoken-q"]')
                .filter(function () {
                    return /abbv-quizddg-qtoken-q\d+\b/.test(this.className);
                });
            $(questions).each(function (index, question) {
                generateDDgQuizObjectUseValues(question);
            });
        }
    });
}

/**
 * Function to pass DDG quiz questions.
 * @name passDDGQuestionsFromQuizPanel
 * @param {object} quizPanel
 * @description Iterates through quiz question elements and generates DDG quiz objects.
 */
function passDDGQuestionsFromQuizPanel(quizPanel) {
    quizPanel.$items.forEach(step => {
        if (step.$name !== 'summary') {
            var questions = $('#' + step.$id)
                .find('[class*="abbv-quizddg-qtoken-q"]')
                .filter(function () {
                    return /abbv-quizddg-qtoken-q\d+\b/.test(this.className);
                });
            $(questions).each(function (index, question) {
                generateDDgQuizObject(question);
            });
        }
    });
}

/**
 * Function to download DDG PDF
 * @name baseDDGDownloadPdf DDG Download PDF
 * @param {object} btnObj
 * @param {boolean} [skipResetAnalyticsFieldValues]
 * @param {scope} globals
 **/
function baseDDGDownloadPdf(btnObj, skipResetAnalyticsFieldValues, globals) {
    if (validateAllFormCheckboxes()) {
        setLoloDDGQuestions(globals);
        if ($('.question1Panel input[type="checkbox"]:checked').length) {
            ddgType1[0].vq2a1 = "answered";
        } else {
            ddgType1[0].vq2a1 = "unanswered";
        }
        if ($('.question2Panel input[type="checkbox"]:checked').length) {
            ddgType1[0].vq2a2 = "answered";
        } else {
            ddgType1[0].vq2a2 = "unanswered";
        }
        if ($('.question3Panel input[type="checkbox"]:checked').length) {
            ddgType1[0].vq2a3 = "answered";
        } else {
            ddgType1[0].vq2a3 = "unanswered";
        }
        if ($('.question4Panel input[type="checkbox"]:checked').length) {
            ddgType1[0].vq2a4 = "answered";
        } else {
            ddgType1[0].vq2a4 = "unanswered";
        }
        baseDdgQuizDownloadPdf(btnObj, skipResetAnalyticsFieldValues, globals);
    }
}

/**
 * Function to pass DDG quiz questions.
 * @name passDDGQuestionsWithDelay
 * @param {scope} globals
 * @description Iterates through quiz question elements and generates DDG quiz objects.
 */
function passDDGQuestionsWithDelay(globals) {
    setTimeout(
        function () {
            var ddgQuizForm = globals.form.ddgQuiz;
            ddgQuizForm.$items.forEach(step => {
                if (step.$name !== 'summary') {
                    var questions = $('#' + step.$id)
                        .find('[class*="abbv-quizddg-qtoken-q"]')
                        .filter(function () {
                            return /abbv-quizddg-qtoken-q\d+\b/.test(this.className);
                        });
                    $(questions).each(function (index, question) {
                        generateDDgQuizObject(question);
                    });
                }
            });
        }, 100);
}

/**
 * @name passDDGQuestionsUseValuesWithDelay
 * @param {scope} globals
 */
function passDDGQuestionsUseValuesWithDelay(globals) {
    setTimeout(passDDGQuestionsUseValues, 100, globals)
}

/* Function to generate ddgquiz object  for summary page*/
function generateDDgQuizObject(question) {
    var cssClasses = question.className.split(" ");
    var questionCssClass = cssClasses.filter(function (cls) {
        return cls.startsWith("abbv-quizddg-qtoken-q");
    });

    var questionNo = questionCssClass[0].split("abbv-quizddg-qtoken-q")[1];
    generateDDGQuiz["q" + questionNo + "a" + questionNo] = {};
    var inputElements = $(question).find("input, textarea, select");
    var questionText = {};

    if (inputElements.length > 0) {
        questionText["question"] = $(question).find('.question-text').length > 0 ? $(question).find('.question-text')[0].innerText.replace(/,/g, '&#44;') : "question";
        generateDDGQuiz["q" + questionNo] = questionText;

        if ($(inputElements[0]).attr("type") === "checkbox") {
            if ($(question).find(" input[type='checkbox'][checked=checked]").length > 0) {
                inputElements = $(question).find("input[type ='checkbox']");
                for (var ele = 0; ele < inputElements.length; ele++) {
                    answerType = $(inputElements[ele]).attr("type");
                    questionAnswer = getDDGQuizAnswers($(inputElements[ele]), questionNo, answerType, '', ele + 1);
                    generateDDGQuiz["q" + questionNo + "a" + questionNo] = appendObjects(generateDDGQuiz["q" + questionNo + "a" + questionNo], questionAnswer);
                }
            } else {
                generateDDGQuiz["q" + questionNo + "a" + questionNo] = "unanswered";
            }
        } else {
            if ($(inputElements[0]).attr("type")) {
                answerType = $(inputElements[0]).attr("type");
            } else if (inputElements[0].type === "select-one" || inputElements[0].type === "select-multiple") {
                answerType = "select";
            } else if ($(inputElements[0]).is('textarea')) {
                answerType = "text";
            }
            questionAnswer = getDDGQuizAnswers($(inputElements[0]), questionNo, answerType);

            if (typeof (questionAnswer) == "object") {
                generateDDGQuiz["q" + questionNo + "a" + questionNo] = appendObjects(generateDDGQuiz["q" + questionNo + "a" + questionNo], questionAnswer);
            } else {
                if (questionAnswer.includes(":")) {
                    questionAnswer = questionAnswer.replace(/:/g, '&#58;');
                }
                generateDDGQuiz["q" + questionNo + "a" + questionNo] = questionAnswer;
            }
        }
    }

    ddgType1[parseInt(questionNo) - 1] = {};
    for (var ele1 in ddgType2) {
        if (ele1.indexOf("sq" + questionNo + "a") !== -1 && ele1 !== "sq" + questionNo + "a1") {
            delete ddgType2[ele1];
        }
    }
    tokenGeneration(generateDDGQuiz["q" + questionNo + "a" + questionNo], questionNo, 1, 1, 1, true);
    for (var i = 0; i < ddgType1.length; i++) {
        for (var element1 in ddgType1[i]) {
            ddgType1[i][element1] = ddgType1[i][element1].replace(/,/g, "&#44;");
        }
    }
}


function generateDDgQuizObjectUseValues(question) {
    var cssClasses = question.className.split(" ");
    var questionCssClass = cssClasses.filter(function (cls) {
        return cls.startsWith("abbv-quizddg-qtoken-q");
    });

    var questionNo = questionCssClass[0].split("abbv-quizddg-qtoken-q")[1];
    generateDDGQuiz["q" + questionNo + "a" + questionNo] = {};
    var inputElements = $(question).find("input, textarea, select");
    var questionText = {};

    if (inputElements.length > 0) {
        questionText["question"] = $(question).find('.question-text').length > 0 ? $(question).find('.question-text')[0].innerText.replace(/,/g, '&#44;') : "question";
        generateDDGQuiz["q" + questionNo] = questionText;

        if ($(inputElements[0]).attr("type") === "checkbox") {
            if ($(question).find(" input[type='checkbox'][checked=checked]").length > 0) {
                inputElements = $(question).find("input[type ='checkbox']");
                for (var ele = 0; ele < inputElements.length; ele++) {
                    answerType = $(inputElements[ele]).attr("type");
                    questionAnswer = getDDGQuizAnswersUseValues($(inputElements[ele]), questionNo, answerType, '', ele + 1);
                    generateDDGQuiz["q" + questionNo + "a" + questionNo] = appendObjects(generateDDGQuiz["q" + questionNo + "a" + questionNo], questionAnswer);
                }
            } else {
                generateDDGQuiz["q" + questionNo + "a" + questionNo] = "unanswered";
            }
        } else {
            if ($(inputElements[0]).attr("type")) {
                answerType = $(inputElements[0]).attr("type");
            } else if (inputElements[0].type === "select-one" || inputElements[0].type === "select-multiple") {
                answerType = "select";
            } else if ($(inputElements[0]).is('textarea')) {
                answerType = "text";
            }
            questionAnswer = getDDGQuizAnswersUseValues($(inputElements[0]), questionNo, answerType);

            if (typeof (questionAnswer) == "object") {
                generateDDGQuiz["q" + questionNo + "a" + questionNo] = appendObjects(generateDDGQuiz["q" + questionNo + "a" + questionNo], questionAnswer);
            } else {
                if (questionAnswer.includes(":")) {
                    questionAnswer = questionAnswer.replace(/:/g, '&#58;');
                }
                generateDDGQuiz["q" + questionNo + "a" + questionNo] = questionAnswer;
            }
        }
    }

    ddgType1[parseInt(questionNo) - 1] = {};
    for (var ele1 in ddgType2) {
        if (ele1.indexOf("sq" + questionNo + "a") !== -1 && ele1 !== "sq" + questionNo + "a1") {
            delete ddgType2[ele1];
        }
    }
    tokenGeneration(generateDDGQuiz["q" + questionNo + "a" + questionNo], questionNo, 1, 1, 1, true);
    for (var i = 0; i < ddgType1.length; i++) {
        for (var element1 in ddgType1[i]) {
            ddgType1[i][element1] = ddgType1[i][element1].replace(/,/g, "&#44;");
        }
    }
}

/**
 * Function to replace special characters in answers
 * @name replaceTokenAnswers
 * @param {string} answer
 * @returns {string} answer with special characters replaced
 */
function replaceTokenAnswers(answer) {
    return answer
        .replaceAll('"', '&#34;')
        .replaceAll('\n', '<br>')
        .replaceAll('©', '&#169;')
        .replaceAll('™', '&#8482;')
        .replaceAll('®', '&#174;')
        .replaceAll('’', '&#39;');
}

/* Function to generate token for type1,type2  summary  */
function tokenGeneration(ddgQuizObject, tquestionNo, tanswer, tsq, tsqa, resetSummaryObject) {
    var questionNo = tquestionNo,
        sq = tsq,
        sqa = tsqa,
        answer = tanswer;
    var prevQuesNo = parseInt(questionNo, 10) - 1;
    if (ddgQuizObject) {
        if (summaryObject && resetSummaryObject === true) {
            for (var val in summaryObject) {
                var value = val;
                if (value.indexOf("abbv-quizddg-qtoken-q" + questionNo + "-a") !== -1) {
                    summaryObject[value] = "";
                }
            }
        }
        if (typeof (ddgQuizObject) == "object") {
            for (var token in ddgQuizObject) {
                var ans = token;
                if (ans.indexOf("_") !== -1) {
                    sq = 1;
                    sqa = 1;
                    answer = answer > 1 ? answer - 1 : answer;
                    if (typeof (ddgQuizObject[ans]) == "object") {
                        tokenGeneration(ddgQuizObject[ans], questionNo, answer, sq, sqa);
                        sq++;
                    }
                } else {
                    if (typeof (ddgQuizObject[ans]) == "object") {
                        tokenGeneration(ddgQuizObject[ans], questionNo, answer, sq, sqa);
                    } else {
                        if (ans === "question") {
                            ddgType1[prevQuesNo]["vabbv-quizddg-qtoken-q" + questionNo] = ddgQuizObject[ans];
                            ddgType2["sabbv-quizddg-qtoken-q" + questionNo] = ddgQuizObject[ans];
                        } else if (ddgQuizObject[ans] === "selected") {
                            if (ans.indexOf("-name") === -1) {
                                summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a" + answer] = ans;
                                ddgType1[prevQuesNo]["vq" + questionNo + "a" + answer] = replaceTokenAnswers(ans);
                                ddgType1[prevQuesNo]["cq" + questionNo + "a"] = ddgType1[prevQuesNo]["cq" + questionNo + "a"] ? ddgType1[prevQuesNo]["cq" + questionNo + "a"] += ", " + replaceTokenAnswers(ans) : replaceTokenAnswers(ans);
                                summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a"] = summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a"] ? summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a"] += ", " + ans : ans;
                                ddgType2["sq" + questionNo + "a" + answer] = "selected";
                            } else {
                                answer = answer - 1;
                                ddgType1[prevQuesNo]["iq" + questionNo + "a" + (answer)] = replaceTokenAnswers(ans).replace("-name", '');
                            }

                        } else if (ddgQuizObject[ans] === " " || ddgQuizObject[ans] === "") {
                            if (ans.indexOf("-name") === -1) {
                                ddgType2["sq" + questionNo + "a" + answer] = "";
                            }
                        } else if (ddgQuizObject[ans] === "unanswered") {
                            if (ans.indexOf("-name") === -1) {
                                summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a"] = "unanswered";
                                ddgType1[prevQuesNo]["vq" + questionNo + "a" + answer] = "unanswered";
                                ddgType2["sq" + questionNo + "a" + answer] = "";
                            } else {
                                ddgType1[prevQuesNo]["iq" + questionNo + "a1"] = "unanswered";

                            }
                        } else if (ddgQuizObject[ans] === "subselected") {
                            if (ans.indexOf("-name") === -1) {
                                summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a" + answer + "-sq" + sq + "-a" + sqa] = ans;
                                ddgType1[prevQuesNo]["vq" + questionNo + "a" + answer + "sq" + sq + "a" + sqa] = replaceTokenAnswers(ans);
                                ddgType1[prevQuesNo]["cq" + questionNo + "a" + answer + "sq" + sq + "a"] =
                                    ddgType1[prevQuesNo]["cq" + questionNo + "a" + answer + "sq" + sq + "a"] ? ddgType1[prevQuesNo]["cq" + questionNo + "a" + answer + "sq" + sq + "a"] += ", " + replaceTokenAnswers(ans) : replaceTokenAnswers(ans);
                                summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a" + answer + "-sq" + sq + "-a"] =
                                    summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a" + answer + "-sq" + sq + "-a"] ? summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a" + answer + "-sq" + sq + "-a"] += ans : ans;
                                ddgType2["sq" + questionNo + "a" + answer + "sq" + sq + "a" + sqa] = "selected";
                                sqa++;
                            } else {
                                ddgType1[prevQuesNo]["iq" + questionNo + "a" + answer + "sq" + (sq) + "a" + (sqa - 1)] = replaceTokenAnswers(ans).replace("-name", '');
                            }
                            answer = answer - 1;
                        } else if (ddgQuizObject[ans] === "subunselected") {
                            ddgType2["sq" + questionNo + "a" + answer + "sq" + sq + "a" + sqa] = "";
                            answer = answer - 1;
                            sqa++;

                        } else {
                            if (ans.indexOf("-name") === -1) {
                                summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a" + answer + "-sq" + sq + "-a" + sqa] = ddgQuizObject[token];
                                ddgType1[prevQuesNo]["vq" + questionNo + "a" + answer + "sq" + sq + "a" + sqa] = replaceTokenAnswers(ddgQuizObject[ans]);
                                ddgType2["sq" + questionNo + "a" + answer + "sq" + sq + "a" + sqa] = "selected";
                                sqa++;
                            } else {
                                ddgType1[prevQuesNo]["iq" + questionNo + "a" + answer + "sq" + sq + "a" + (sqa - 1)] = replaceTokenAnswers(ddgQuizObject[ans]);
                            }
                            answer = answer - 1;

                        }
                    }
                }
                if (ans.indexOf("-name") === -1) {
                    answer++;
                }
            }
        } else {
            summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a"] = ddgQuizObject;
            ddgType1[prevQuesNo]["vq" + questionNo + "a" + answer] = replaceTokenAnswers(ddgQuizObject);
            ddgType2["sq" + questionNo + "a" + answer] = (ddgQuizObject === "unanswered" ? "" : "selected");
            if (ddgQuizObject === "unanswered") {
                ddgType1[prevQuesNo]["cq" + questionNo + "a"] = "unanswered";
                ddgType1[prevQuesNo]["iq" + questionNo + "a" + answer] = "unanswered";
                summaryObject["abbv-quizddg-qtoken-q" + questionNo + "-a"] = "unanswered";
            }
        }
    }
}


/* Function to get questions and answers object  for summary page*/
function getDDGQuizAnswers(element, questionNo, answerType, subq, checkboxIndex) {
    var questionAnswer = "", answerKeySelected = "";
    switch (answerType) {
        case "text":
        case "date":
        case "number":
        case "email":
            questionAnswer = ($(element)[0].value) ? $(element)[0].value : "unanswered";
            break;
        case "radio":
            questionAnswer = {};
            var checkedRadioElement;
            if (subq === 'true') {
                checkedRadioElement = $('.abbv-quizddg-question' + questionNo + ' input[type="radio"][checked=checked]');
            } else {
                checkedRadioElement = $('.abbv-quizddg-qtoken-q' + questionNo + ' input[type="radio"][checked=checked]');
            }
            if (checkedRadioElement.length > 0) {
                var radioElementSubQuesLabel = checkedRadioElement.parent().parent().find('span');
                var radioElementSubQuesValue = checkedRadioElement.attr("value");
                var radioElementLabel = checkedRadioElement.parent().parent().find('span');
                var radioElementValue = checkedRadioElement.attr("value");
                var checkSubQuestion = radioElementSubQuesLabel.length > 0 ? radioElementSubQuesLabel[0].innerText : radioElementSubQuesValue;
                var checkQuestion = radioElementLabel.length > 0 ? radioElementLabel[0].innerText : radioElementValue;
                var qVal = subq ? checkSubQuestion : checkQuestion;
                questionAnswer[qVal] = subq ? "subselected" : "selected";
                questionAnswer[subq ? radioElementSubQuesValue : radioElementValue + "-name"] = subq ? "subselected" : "selected";
            } else {
                questionAnswer["selection-name"] = "unanswered";
                questionAnswer["selection"] = "unanswered";
            }
            if ($(element).parent().parent().hasClass('subquestion-css')) {
                var radioElement = $(element).parent().parent();
                var subel = handleSubQuestions(radioElement, questionNo);
                questionAnswer = appendObjects(questionAnswer, subel);
            }
            break;
        case "select":
            questionAnswer = {};
            var selectElementSubQues = $('.abbv-quizddg-qtoken-q' + questionNo + " [selected=selected]");
            var selOption = selectElementSubQues.length > 0 ? selectElementSubQues[0] : "";
            var selectCheckSubQues = selectElementSubQues.length > 0 ? selectElementSubQues.text() : "selection";
            var selectCheckQues = selectElementSubQues.length > 0 ? $(selOption).text() : "selection";
            var selectAnswerCheck = subq ? "subselected" : "selected";
            questionAnswer[subq ? selectCheckSubQues : selectCheckQues] = $(element)[0].value ? selectAnswerCheck : "unanswered";
            questionAnswer[$(element)[0].value ? $(element)[0].value + "-name" : "selection-name"] = $(element)[0].value ? selectAnswerCheck : "unanswered";
            if ($(element)[0].value && $(element).parent().parent().hasClass('subquestion-css')) {
                var dropdownElement = $(element).parent().parent();
                var sub = handleSubQuestions(dropdownElement, questionNo, answerKeySelected);
                questionAnswer = appendObjects(questionAnswer, sub);
            }
            break;
        case "checkbox":
            var checkboxElement = element;
            var checkboxValue = $(checkboxElement).parent().parent().find('span, label')[0].innerText.trim();
            var checkboxName = $(checkboxElement).attr('value');
            var checkboxParentClass = $(checkboxElement).parent().parent().attr("class");
            var answerKeyIndex = checkboxParentClass.indexOf("q" + questionNo + "a");
            var answerKey = answerKeyIndex > -1 ? checkboxParentClass.slice(answerKeyIndex).split(" ")[0] : "q" + questionNo + "a" + checkboxIndex;
            answerKeySelected = subq ? questionNo : answerKey;
            questionAnswer = {};
            questionAnswer[answerKeySelected] = {};

            if ($(checkboxElement).attr("checked") === "checked") {
                checkboxElement = $(checkboxElement).parent().parent();
                questionAnswer[answerKeySelected][checkboxValue] = subq ? "subselected" : "selected";
                questionAnswer[answerKeySelected][checkboxName + "-name"] = subq ? "subselected" : "selected";
                if ($(checkboxElement).hasClass('subquestion-css') || $(checkboxElement).parent().parent().hasClass('subquestion-css')) {
                    var subquesAnswer = handleSubQuestions(checkboxElement, questionNo, answerKeySelected);
                    questionAnswer = appendObjects(questionAnswer, subquesAnswer);
                }
            } else {
                questionAnswer[answerKeySelected][checkboxName + "-name"] = subq ? "subunselected" : "";
                questionAnswer[answerKeySelected][checkboxValue] = subq ? "subunselected" : "";
            }
            break;
    }
    return questionAnswer;
}


function getDDGQuizAnswersUseValues(element, questionNo, answerType, subq, checkboxIndex) {
    var questionAnswer = "", answerKeySelected = "";
    switch (answerType) {
        case "text":
        case "date":
        case "number":
            questionAnswer = ($(element)[0].value) ? $(element)[0].value : "unanswered";
            break;
        case "radio":
            questionAnswer = {};
            var checkedRadioElement;
            if (subq === 'true') {
                checkedRadioElement = $('.abbv-quizddg-question' + questionNo + ' input[type="radio"][checked=checked]');
            } else {
                checkedRadioElement = $('.abbv-quizddg-qtoken-q' + questionNo + ' input[type="radio"][checked=checked]');
            }
            if (checkedRadioElement.length > 0) {
                var radioElementSubQuesValue = checkedRadioElement.attr("value");
                var radioElementValue = checkedRadioElement.attr("value");
                var checkSubQuestion = radioElementSubQuesValue;
                var checkQuestion = radioElementValue;
                var qVal = subq ? checkSubQuestion : checkQuestion;
                questionAnswer[qVal] = subq ? "subselected" : "selected";
                questionAnswer[subq ? radioElementSubQuesValue : radioElementValue + "-name"] = subq ? "subselected" : "selected";
            } else {
                questionAnswer["selection-name"] = "unanswered";
                questionAnswer["selection"] = "unanswered";
            }
            if ($(element).parent().parent().hasClass('subquestion-css')) {
                var radioElement = $(element).parent().parent();
                var subel = handleSubQuestions(radioElement, questionNo);
                questionAnswer = appendObjects(questionAnswer, subel);
            }
            break;
        case "select":
            questionAnswer = {};
            var selectElementSubQues = $('.abbv-quizddg-qtoken-q' + questionNo + " [selected=selected]");
            var selOption = selectElementSubQues.length > 0 ? selectElementSubQues[0] : "";
            var selectCheckSubQues = selectElementSubQues.length > 0 ? selectElementSubQues.text() : "selection";
            var selectCheckQues = selectElementSubQues.length > 0 ? $(selOption).text() : "selection";
            var selectAnswerCheck = subq ? "subselected" : "selected";
            questionAnswer[subq ? selectCheckSubQues : selectCheckQues] = $(element)[0].value ? selectAnswerCheck : "unanswered";
            questionAnswer[$(element)[0].value ? $(element)[0].value + "-name" : "selection-name"] = $(element)[0].value ? selectAnswerCheck : "unanswered";
            if ($(element)[0].value && $(element).parent().parent().hasClass('subquestion-css')) {
                var dropdownElement = $(element).parent().parent();
                var sub = handleSubQuestions(dropdownElement, questionNo, answerKeySelected);
                questionAnswer = appendObjects(questionAnswer, sub);
            }
            break;
        case "checkbox":
            var checkboxElement = element;
            var checkboxValue = $(checkboxElement).val();
            var checkboxName = $(checkboxElement).attr('value');
            var checkboxParentClass = $(checkboxElement).parent().parent().attr("class");
            var answerKeyIndex = checkboxParentClass.indexOf("q" + questionNo + "a");
            var answerKey = answerKeyIndex > -1 ? checkboxParentClass.slice(answerKeyIndex).split(" ")[0] : "q" + questionNo + "a" + checkboxIndex;
            answerKeySelected = subq ? questionNo : answerKey;
            questionAnswer = {};
            questionAnswer[answerKeySelected] = {};

            if ($(checkboxElement).attr("checked") === "checked") {
                checkboxElement = $(checkboxElement).parent().parent();
                questionAnswer[answerKeySelected][checkboxValue] = subq ? "subselected" : "selected";
                questionAnswer[answerKeySelected][checkboxName + "-name"] = subq ? "subselected" : "selected";
                if ($(checkboxElement).hasClass('subquestion-css') || $(checkboxElement).parent().parent().hasClass('subquestion-css')) {
                    var subquesAnswer = handleSubQuestions(checkboxElement, questionNo, answerKeySelected);
                    questionAnswer = appendObjects(questionAnswer, subquesAnswer);
                }
            } else {
                questionAnswer[answerKeySelected][checkboxName + "-name"] = subq ? "subunselected" : "";
                questionAnswer[answerKeySelected][checkboxValue] = subq ? "subunselected" : "";
            }
            break;
    }
    return questionAnswer;
}

/* Function to handle subquestions  for summary page*/
function handleSubQuestions(radioElement, questionNo, answerKeySelected) {
    var questionAnswer = {}, subQuestionValues = {}, subQuestionNo, ques = "", subQuestionElements = [], typ = "";
    if (answerKeySelected) {
        subQuestionNo = answerKeySelected.substring(answerKeySelected.indexOf('a') + 1, answerKeySelected.length);
    } else {
        var subQuestionElementClassObject = $(radioElement).parents().find("div[class *='abbv-quizddg-qtoken-q" + questionNo + "'][class *='_']").attr("class");
        var subQuestionClass = subQuestionElementClassObject.slice(subQuestionElementClassObject.indexOf('abbv-quizddg-qtoken-q' + questionNo + '_')).split(" ")[0];
        subQuestionNo = subQuestionClass.split('_')[1];
    }
    var subQuestionElement = $('.abbv-quizddg-qtoken-q' + questionNo + '_' + subQuestionNo);
    var subQuestionInputEle = subQuestionElement.find("input");
    var subQuestionSelectEle = subQuestionElement.find("select");
    var subQuestionSelectEleCheck = subQuestionSelectEle.length > 0 ? subQuestionSelectEle : [];
    subQuestionElements = subQuestionInputEle.length > 0 ? subQuestionInputEle : subQuestionSelectEleCheck;
    for (var item = 0; item < subQuestionElements.length; item++) {
        typ = $(subQuestionElements[item]).attr("type") ? $(subQuestionElements[item]).attr("type") : "select";
        var subQuestionLabel = $(".abbv-quizddg-question" + questionNo + "-sq" + subQuestionNo + "-" + (item + 1) + " label");
        ques = subQuestionLabel.length > 0 ? subQuestionLabel[0].innerText : "ques" + questionNo + "-" + subQuestionNo;
        var param = questionNo + "-sq" + subQuestionNo + "-" + (item + 1);
        if (typ === "checkbox") {
            subQuestionValues = appendObjects(subQuestionValues, getDDGQuizAnswers(subQuestionElements[item], param, typ, "true"));
        } else {
            var selectValue = getDDGQuizAnswers(subQuestionElements[item], param, typ, "true");
            var selectionQues = Object.keys(selectValue)[0] === "selection" ? "subunselected" : Object.keys(selectValue)[0];
            subQuestionValues[ques] = typ === "select" ? selectionQues : selectValue;
            if (typ === "select" || typ === "radio") {
                subQuestionValues[ques + "-name"] = typ === "select" ? selectionQues : selectValue;
            }
        }
    }
    if (answerKeySelected) {
        questionAnswer[answerKeySelected + "_1"] = {};
        questionAnswer[answerKeySelected + "_1"] = appendObjects(questionAnswer[answerKeySelected + "_1"], subQuestionValues);
    } else {
        questionAnswer["q" + questionNo + "a" + questionNo + "_" + subQuestionNo] = {};
        questionAnswer["q" + questionNo + "a" + questionNo + "_" + subQuestionNo] = appendObjects(questionAnswer["q" + questionNo + "a" + questionNo + "_" + subQuestionNo], subQuestionValues);
    }
    return questionAnswer;
}

/*Appending items/objects to an existing object ES5 version of object.assign*/
function appendObjects() {
    var res = {};
    for (var i = 0; i < arguments.length; i++) {
        for (var x in arguments[i]) {
            res[x] = arguments[i][x];
        }
    }
    return res;
}

/* Function to Update payload with status Message */
function updatePayload(ddgType1, status) {
    if (status !== null && status !== '') {
        ddgType1[parseInt(ddgType1.length)] = {};
        if (status) {
            ddgType1[parseInt(ddgType1.length) - 1]["status"] = "Yes";
        } else {
            ddgType1[parseInt(ddgType1.length) - 1]["status"] = "No";
        }

        return ddgType1;
    } else {
        return ddgType1;
    }

}

/**
 * Function to generate payload with symptoms
 * @name generatePayloadSymptoms
 * @param {object} symptoms
 * @param {string} pagePath
 * @param {string} status
 * @param {string} emailIdentifier
 */
function generatePayloadSymptoms(symptoms, pagePath, status, emailIdentifier) {
    var emailAddress = $('.email-address').find('input').val();
    var custIdentifier = $('.customer-identifier').find('input').val();
    finalPayload["type1"] = JSON.stringify(updatePayload(ddgType1, status));
    finalPayload["type2"] = ddgType2;
    finalPayload["totalTimeDays"] = totalImpactTimeInDays;
    finalPayload["totalTimeHours"] = totalImpactTimeInHrs;
    finalPayload["emailAddress"] = emailAddress || '';
    finalPayload["pagePath"] = pagePath || '';
    if (emailIdentifier) {
        finalPayload["emailIdentifier"] = custIdentifier || '';
    }
    if (symptoms) {
        finalPayload["symptoms"] = JSON.stringify(symptoms);
    }
}

function generateDdgQuizEmail(emailAddress, emailName, pagePath, redirectNeeded, email, emailSuccessPanel, sendNowButton, recaptcha, globals) {
    generateDdgQuizEmailExtended(emailAddress, emailName, pagePath, redirectNeeded, email, emailSuccessPanel, sendNowButton, recaptcha, null, null, globals);
}

/**
 * Function to generate Email
 * @param {string} emailAddress
 * @param {string} emailName
 * @param {string} pagePath
 * @param {boolean} redirectNeeded
 * @param {object} email
 * @param {object} emailSuccessPanel
 * @param {object} sendNowButton
 * @param {object} recaptcha
 * @param {object} pdfPanel
 * @param {object} summaryPanel
 * @param {scope} globals
 */
function generateDdgQuizEmailExtended(emailAddress, emailName, pagePath, redirectNeeded, email, emailSuccessPanel, sendNowButton, recaptcha, pdfPanel, summaryPanel, globals) {
    var indicationName = baseGetCookieValue('indicationName');
    var finalIndicationPath = '';
    var globalISIPath = '';
    if (window.parent.AbbViePageInfo.indicationEndPoints) {
        var indicationPath = window.parent.AbbViePageInfo.indicationEndPoints.inlineUse;
        finalIndicationPath = indicationPath.substring(0, indicationPath.lastIndexOf('{{'));
        //Get Inline Full ISI & Condensed ISI Path(For both indication specific & non)
        globalISIPath = indicationName !== '' ? finalIndicationPath + indicationName : finalIndicationPath;
        finalIndicationPath += (indicationName || 'generic-indication');
    }

    var quizddgPayload = JSON.stringify(finalPayload);
    quizddgPayload = quizddgPayload.replaceAll("{},", "");
    var dataObject = {
        quizddg: quizddgPayload,
        emailAddress: emailAddress,
        emailName: emailName,
        pagePath: pagePath,
        finalIndicationPath: finalIndicationPath,
        globalISIPath: globalISIPath,
        totalImpactTimeInDays: totalImpactTimeInDays,
        totalImpactTimeInHrs: totalImpactTimeInHrs
    };
    if (typeof abbvSymptomSelector !== 'undefined') {
        var view = abbvSymptomSelector.getView();
        if (view) {
            dataObject.lastView = view;
        }
    }

    sendMail(dataObject, {
        success: function (response) {
            if (redirectNeeded && window.abbviecloudforms.core.formProperties.thankyoupageurl) {
                redirectToThankYouPage(window.abbviecloudforms.core.formProperties.thankyoupageurl);
            } else {
                globals.functions.setProperty(email, {visible: false});
                globals.functions.setProperty(emailSuccessPanel, {visible: true});
                globals.functions.setProperty(sendNowButton, {visible: false});
                globals.functions.setProperty(recaptcha, {visible: false});
                if (pdfPanel) {
                    globals.functions.setProperty(pdfPanel, {visible: false});
                }
                if (summaryPanel) {
                    globals.functions.setProperty(summaryPanel, {visible: false});
                }
            }
        },
        error: function (error) {
            console.log("Email Not Sent: " + error);
        }
    });
}

function generateSavingCardMail(emailAddress, firstName, result, indicationId, globals) {
    var indicationName = baseGetCookieValue('indicationName');
    var finalIndicationPath = '';
    var globalISIPath = '';

    if (window.parent.AbbViePageInfo.indicationEndPoints) {
        var indicationPath = window.parent.AbbViePageInfo.indicationEndPoints.inlineUse;
        finalIndicationPath = indicationPath.substring(0, indicationPath.lastIndexOf('{{'));
        //Get Inline Full ISI & Condensed ISI Path(For both indication specific & non)
        globalISIPath = indicationName !== '' ? finalIndicationPath + indicationName : finalIndicationPath;
        finalIndicationPath += (indicationName || 'generic-indication');
    }

    var cardDetails = result ? result.ContentResult.CopayCard : {};
    var path = location.href;
    path = path.split("/_jcr_content");
    var pathUrl = path[0].substr(path[0].indexOf("/", path[0].indexOf("/") + 2));
    var currentPageUrl = window.parent.AbbViePageInfo ? window.parent.AbbViePageInfo.pagepath : pathUrl;
    var dataObject = {
        firstname: firstName,
        emailAddress: emailAddress,
        emailName: "savingscard",
        cardDetails: cardDetails,
        indicationId: indicationId,
        pagePath: currentPageUrl,
        finalIndicationPath: finalIndicationPath,
        globalISIPath: globalISIPath
    };

    if (loginCheck()) {
        sendMail(dataObject, {
            success: function (response) {
                if (response) {
                    var emailResponse = JSON.parse(response);
                    var status = emailResponse.status;
                    if (status) {
                        $(".saving--card--email--notification").show();
                        $(".saving--card--email--error--notification").hide();
                        if (globals) {
                            prefillFormDataAfterSubmission(globals);
                        }
                    } else {
                        $(".saving--card--email--notification").hide();
                        $(".saving--card--email--error--notification").show();
                    }
                }
            },
            error: function (error) {
                $(".saving--card--email--error--notification").show();
            }
        });
    }
}

function sendMail(dataObject, callback, asyncType) {
    var reqObj = {
        url: "/bin/abbvieforms/abbvieemail",
        method: 'post',
        data: dataObject
    };
    if (asyncType) {
        reqObj.async = JSON.parse(asyncType);
    }

    $.ajax(reqObj)
        .done(function (response) {
            console.log("Email Sent Successfully");
            callback.success(response);
        })
        .fail(function (error) {
            console.log("Email Not Sent");
            callback.error(error);
        });
}

function prefillFormDataAfterSubmission(globals) {
    var emailVal = $('#' + globals.form.$id + ' .js-prefill-email input').eq(0).val();
    var zipCodeVal = $('#' + globals.form.$id + ' .js-prefill-zipcode input').eq(0).val();
    if (emailVal) {
        abbvFormPrefillSet('email', emailVal);
    }
    if (zipCodeVal) {
        abbvFormPrefillSet('zipcode', zipCodeVal);
    }
}

/*Wrapper function to call abbv-framework prefill object */
function abbvFormPrefillSet(key, value) {
    if (key && value) {
        window.parent.abbvPrefill.set(key, value);
    }
}

function pdfQuizDDGAnswers(emailAddress, pdfType, pagePath, submitButton) {
    var elementName = submitButton.$name;
    var indicationName = baseGetCookieValue('indicationName');
    var finalIndicationPath = '';
    var globalISIPath = '';
    var indicationPath = '';
    var symptomView;

    if (window.parent.AbbViePageInfo.indicationEndPoints) {
        indicationPath = window.parent.AbbViePageInfo.indicationEndPoints.inlineUse;
        finalIndicationPath = indicationPath.substring(0, indicationPath.lastIndexOf('{{'));
        //Get Inline Full ISI & Condensed ISI Path(For both indication specific & non)
        globalISIPath = indicationName !== '' ? finalIndicationPath + indicationName : finalIndicationPath;
        finalIndicationPath += (indicationName || 'generic-indication');
    }
    console.log('in pdfQuizDDGAnswers() -- ' + JSON.stringify(finalPayload) + ' -- ' + emailAddress + ' -- ' + pdfType + ' -- ' + pagePath + ' -- ' + elementName);
    var payloadObj = {
        quizddg: JSON.stringify(payload),
        pdftype: pdfType,
        pagePath: pagePath,
        finalIndicationPath: finalIndicationPath,
        globalISIPath: globalISIPath,
        /*U65A-759 changes*/
        //element:'',
        emailAddress: emailAddress,
        totalImpactTimeInDays: totalImpactTimeInDays,
        totalImpactTimeInHrs: totalImpactTimeInHrs
    };

    if (typeof abbvSymptomSelector != 'undefined') {
        symptomView = abbvSymptomSelector.getView();
        if (symptomView) {
            payloadObj.lastView = symptomView;
        }
    }
    console.log("payload" + JSON.stringify(payloadObj));
    var serviceURI = "/bin/abbvieforms/abbvieddgpdf";

    fetch(serviceURI, {
        method: 'POST',
        body: new URLSearchParams({
            data: JSON.stringify(payloadObj)
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
    }).then(response => {
        if (response.ok) {
            const disposition = response.headers.get('Content-Disposition');
            let fileName = 'download.pdf';
            if (disposition && disposition.indexOf('filename=') !== -1) {
                fileName = disposition.split('filename=')[1].replaceAll("'", "").replaceAll('"', "");
            }
            return response.blob().then(blob => ({blob, fileName}));
        } else {
            $('.pdfDownloadError').parent().parent().removeClass('hidden');
            $('.pdfDownloadError.guideFieldError').css("visibility", "visible");
        }
    }).then(({blob, fileName}) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    }).catch(error => {
        $('.pdfDownloadError').parent().parent().removeClass('hidden');
        $('.pdfDownloadError.guideFieldError').css("visibility", "visible");
    });
}


function pdfQuizDDGAnswersWithIdentifier(emailAddress, pdfType, pagePath, submitButton, identifier) {
    var elementName = submitButton.$name;
    var indicationName = baseGetCookieValue('indicationName');
    var finalIndicationPath = '';
    var globalISIPath = '';
    var indicationPath = '';
    var symptomView;

    if (window.parent.AbbViePageInfo.indicationEndPoints) {
        indicationPath = window.parent.AbbViePageInfo.indicationEndPoints.inlineUse;
        finalIndicationPath = indicationPath.substring(0, indicationPath.lastIndexOf('{{'));
        //Get Inline Full ISI & Condensed ISI Path(For both indication specific & non)
        globalISIPath = indicationName !== '' ? finalIndicationPath + indicationName : finalIndicationPath;
        finalIndicationPath += (indicationName || 'generic-indication');
    }
    console.log('in pdfQuizDDGAnswers() -- ' + JSON.stringify(finalPayload) + ' -- ' + emailAddress + ' -- ' + pdfType + ' -- ' + pagePath + ' -- ' + elementName);
    var payloadObj = {
        quizddg: JSON.stringify(payload),
        pdftype: pdfType,
        pagePath: pagePath,
        finalIndicationPath: finalIndicationPath,
        globalISIPath: globalISIPath,
        /*U65A-759 changes*/
        //element:'',
        emailAddress: emailAddress,
        totalImpactTimeInDays: totalImpactTimeInDays,
        totalImpactTimeInHrs: totalImpactTimeInHrs,
        pdfIdentifier: identifier
    };

    if (typeof abbvSymptomSelector != 'undefined') {
        symptomView = abbvSymptomSelector.getView();
        if (symptomView) {
            payloadObj.lastView = symptomView;
        }
    }
    console.log("payload" + JSON.stringify(payloadObj));
    var serviceURI = "/bin/abbvieforms/abbvieddgpdf";

    fetch(serviceURI, {
        method: 'POST',
        body: new URLSearchParams({
            data: JSON.stringify(payloadObj)
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
    }).then(response => {
        if (response.ok) {
            const disposition = response.headers.get('Content-Disposition');
            let fileName = 'download.pdf';
            if (disposition && disposition.indexOf('filename=') !== -1) {
                fileName = disposition.split('filename=')[1].replaceAll("'", "").replaceAll('"', "");
            }
            return response.blob().then(blob => ({blob, fileName}));
        } else {
            $('.pdfDownloadError').parent().parent().removeClass('hidden');
            $('.pdfDownloadError.guideFieldError').css("visibility", "visible");
        }
    }).then(({blob, fileName}) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    }).catch(error => {
        $('.pdfDownloadError').parent().parent().removeClass('hidden');
        $('.pdfDownloadError.guideFieldError').css("visibility", "visible");
    });
}

function baseDdgQuizDownloadPdf(button, skipResetAnalyticsFieldValues, globals) {
    window.parent.AbbViePageInfo = window.parent.AbbViePageInfo || {};
    let pagePath = window.parent.AbbViePageInfo.pagepath ? window.parent.AbbViePageInfo.pagepath : "";
    generatePayloadForPDF(pagePath);
    pdfQuizDDGAnswers(null, "basequizddgpdf", pagePath, button);
    if (!skipResetAnalyticsFieldValues) {
        admp_analytics_functions.analyticsFormInteractionEvent(button);
    }
}

/* Function to generate payload for email and pdf ddq-quiz question */
function generatePayloadForPDF(pagePath, status) {
    var path = pagePath;
    finalPayload["type1"] = JSON.stringify(updatePayload(ddgType1, status));
    finalPayload["type2"] = ddgType2;
    finalPayload["totalTimeDays"] = totalImpactTimeInDays;
    finalPayload["totalTimeHours"] = totalImpactTimeInHrs;
    finalPayload["emailAddress"] = $(".email-address").find('input').val() ? $(".email-address").find('input').val() : "";
    finalPayload["pagePath"] = path ? path : "";
}

/**
 * Function to calculate total impact time of quiz
 * @name quizddgGetImpactTime
 * @param timeclass
 */
function quizddgGetImpactTime(timeclass) {
    var calImpactTimeFlag = $("." + timeclass).length;
    if (calImpactTimeFlag) {
        totalImpactTimeInMins = 0;
        totalImpactTimeInHrs = 0;
        totalImpactTimeInDays = 0;
        if ($('.' + timeclass).length > 0) {
            $('.' + timeclass).each(function (index) {
                ++index;
                if ($(this).attr('data-cmp-visible') === 'true') {
                    var frequencyVal = parseInt($(this).find("." + timeclass + index + " .abbv-form-wrapper input").val(), 10);
                    if (!frequencyVal) {
                        frequencyVal = parseInt($(this).find(" .guideItemSelectedinput input").attr("value"), 10);
                    }
                    var durationVal = parseInt($(this).find("." + timeclass + index + " .numericStepper input").val(), 10);
                    if (frequencyVal && durationVal) {
                        totalImpactTimeInMins = totalImpactTimeInMins + frequencyVal * durationVal;
                    }
                    var selectedValue = parseInt($(this).find("." + timeclass + index + " input[checked='checked']").length > 0 ? $(this).find("." + timeclass + index + " input[checked='checked']").attr("value") : 0, 10);
                    totalImpactTimeInMins = totalImpactTimeInMins + selectedValue * 60;
                }
            });
        }
        totalImpactTimeInHrs = Math.round(totalImpactTimeInMins / 60);
        totalImpactTimeInDays = Math.round(totalImpactTimeInHrs / 24);
        if ($(".totalImpactTimeNumberOfWeeks").length > 0 && $(".totalImpactTimeNumberOfWeeks").find("input").attr("value") && typeof (parseInt($(".totalImpactTimeNumberOfWeeks").find("input").attr("value"), 10)) == "number") {
            totalImpactTimeInHrs = Math.round(totalImpactTimeInHrs * parseInt($(".totalImpactTimeNumberOfWeeks").find("input").attr("value"), 10));
            totalImpactTimeInDays = Math.round(totalImpactTimeInHrs / 24);
        }

    }
}

/** * Function to show total impact time of quiz
 * @name quizddgShowImpactTime
 * @param hoursEleClass
 * @param daysEleClass
 */
function quizddgShowImpactTime(hoursEleClass, daysEleClass) {
    $(window.parent.document).find("." + hoursEleClass + ", ." + daysEleClass).html("");
    $("." + hoursEleClass + ", ." + daysEleClass).html("");

    var totalImpactTimeInHrsEle = '<p class="abbv-impact-time"><span class="abbv-impact-time-hrs-val">' + totalImpactTimeInHrs + '</span><span class="abbv-impact-time-hoursTxt"> hour(s)</span><span class="abbv-impact-time-hoursInfoTxt"> of your time</span></p>';
    var totalImpactTimeInDaysEle = '<p class="abbv-impact-time"><span class="abbv-impact-time-daysTxt">Thats </span> <span class="abbv-impact-time-days-val">' + totalImpactTimeInDays + '</span><span class="abbv-impact-time-daysInfoTxt"> days!</span></p>';

    $(window.parent.document).find("." + hoursEleClass).html(totalImpactTimeInHrsEle);
    $("." + hoursEleClass).html(totalImpactTimeInHrsEle);

    if ($(".totalImpactTimeNumberOfWeeks").length > 0 && $(".totalImpactTimeNumberOfWeeks").find("input").attr("value")) {
        $("." + hoursEleClass).html(totalImpactTimeInHrsEle);
    }

    if (($(".totalImpactTimeNumberOfWeeks").length > 0 && $(".totalImpactTimeNumberOfWeeks").find("input").attr("value") && parseInt($(".totalImpactTimeNumberOfWeeks").find("input").attr("value")) > 1) || totalImpactTimeInDays >= 20) {
        $(window.parent.document).find("." + daysEleClass).html(totalImpactTimeInDaysEle);
        $("." + daysEleClass).html(totalImpactTimeInDaysEle);
    }
}


/**
 * adaptDdgType1SpecialCharactersForIdentifyepiSymptomChecker
 * This function adapts special characters in the ddType1[2].vq3a4 for the IdentifyEPI Symptom Checker.
 * @name adaptDdgType1SpecialCharactersForIdentifyepiSymptomChecker
 */
function adaptDdgType1SpecialCharactersForIdentifyepiSymptomChecker() {
    if (ddgType1[2] && ddgType1[2].vq3a4) {
        ddgType1[2].vq3a4 = ddgType1[2].vq3a4.replace(/’/g, "&rsquo;");
    }
    if (ddgType1[2] && ddgType1[2].vq3a8) {
        ddgType1[2].vq3a8 = ddgType1[2].vq3a8.replace(/’/g, "&rsquo;");
    }
}

var mockNPIData = {
    "status": "SUCCESS",
    "statusCode": 200,
    "content": [
        {
            "city": "Nampa",
            "state": "ID",
            "zip": "83651",
            "zip4": null,
            "country": "US",
            "email": "test0@test.com",
            "degree": "CNP",
            "phone": "5555555555",
            "fax": null,
            "npi": "1902185168",
            "practiceName": "Access Behavioral Health Services",
            "hcp_id": "1111111",
            "address_id": null,
            "first_name": "First",
            "middle_name": "Middle",
            "last_name": "Last",
            "address_line_1": "111 Street Test",
            "primary_specialty": "Nurse Practitioner",
            "contactid": null,
            "primary_keycode": null,
            "approved_products": [
                {
                    "brand_nm": "Venclexta",
                    "sub_brand": "CLL DSA",
                    "apprvd_product_cd": "ONH20",
                    "apprvd_product_nm": "CLL_DSA"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Gastro Contracting",
                    "apprvd_product_cd": "GAM1",
                    "apprvd_product_nm": "Gastro_Contracting"
                },
                {
                    "brand_nm": "Skyrizi/Rinvoq",
                    "sub_brand": "IAE Value Based Care Gastro",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "Value Based Care Gastro"
                },
                {
                    "brand_nm": "Depakote",
                    "sub_brand": "Depakote/Migraine DSA",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Depakote_Migraine_DSA"
                },
                {
                    "brand_nm": "Synthroid",
                    "sub_brand": "Thyroid DSA Only",
                    "apprvd_product_cd": "MET0",
                    "apprvd_product_nm": "Synthroid_DSA"
                },
                {
                    "brand_nm": "Endometriosis DSA",
                    "sub_brand": "Profiling/Womens Health",
                    "apprvd_product_cd": "PRSB0",
                    "apprvd_product_nm": "Endometriosis_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "HABP_VABP_DSA"
                },
                {
                    "brand_nm": "Teflaro",
                    "sub_brand": "Teflaro",
                    "apprvd_product_cd": "LAI0",
                    "apprvd_product_nm": "Teflaro"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "CD_DSA"
                },
                {
                    "brand_nm": "General DSA",
                    "sub_brand": "General Disease Awareness",
                    "apprvd_product_cd": "SF7",
                    "apprvd_product_nm": "General_DSA"
                },
                {
                    "brand_nm": "AML DSA",
                    "sub_brand": "AML DSA",
                    "apprvd_product_cd": "ONH2",
                    "apprvd_product_nm": "AML_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Teflaro_ABSSSI"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "AM_DSA"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "Botox Uro",
                    "apprvd_product_cd": "RTXB",
                    "apprvd_product_nm": "Botox_Uro"
                },
                {
                    "brand_nm": "Depakote",
                    "sub_brand": "Depakote/Bipolar",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Depakote_Bipolar"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Skyrizi/PsA",
                    "apprvd_product_cd": "AI3",
                    "apprvd_product_nm": "Skyrizi_PsA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Lupron_EM"
                },
                {
                    "brand_nm": "Durysta",
                    "sub_brand": "Durysta",
                    "apprvd_product_cd": "DEC1",
                    "apprvd_product_nm": "Durysta"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "Botox Spasticity",
                    "apprvd_product_cd": "AGNPR",
                    "apprvd_product_nm": "Botox_S"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Migraine_DSA"
                },
                {
                    "brand_nm": "Imbruvica",
                    "sub_brand": "IMBRUVICA/CLL",
                    "apprvd_product_cd": "PHEM0",
                    "apprvd_product_nm": "Imbruvica"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Rheumatoid Arthritis",
                    "apprvd_product_cd": "AI0R",
                    "apprvd_product_nm": "Humira_RA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Niaspan"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "viekira_XR"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Uveitis",
                    "apprvd_product_cd": "AI0R",
                    "apprvd_product_nm": "Humira_Uv"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "S_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "MM_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "ABSSSI_DSA"
                },
                {
                    "brand_nm": "Depakote",
                    "sub_brand": "Depakote/Epilepsy DSA",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Depakote_Epilepsy_DSA"
                },
                {
                    "brand_nm": "Depakote",
                    "sub_brand": "Depakote/Epilepsy",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Depakote_Epilepsy"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Norvir_IMHC"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Survanta"
                },
                {
                    "brand_nm": "Dalvance",
                    "sub_brand": "Dalvance",
                    "apprvd_product_cd": "LAI0",
                    "apprvd_product_nm": "Dalvance"
                },
                {
                    "brand_nm": "Avycaz",
                    "sub_brand": "Avycaz",
                    "apprvd_product_cd": "LAI0",
                    "apprvd_product_nm": "Avycaz"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq/Ulcerative Colitis",
                    "apprvd_product_cd": "AI5",
                    "apprvd_product_nm": "Rinvoq_UC"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Linzess_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "CIC-FC_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Norvir_IMHC_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Survanta_DSA"
                },
                {
                    "brand_nm": "Orilissa",
                    "sub_brand": "Orilissa/Endometriosis",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Orilissa"
                },
                {
                    "brand_nm": "General DSA",
                    "sub_brand": "IAE Branded Portfolio",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "IMM Branded Portfolio"
                },
                {
                    "brand_nm": "Ubrelvy",
                    "sub_brand": "Ubrelvy",
                    "apprvd_product_cd": "CNSM0",
                    "apprvd_product_nm": "Ubrelvy"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Pre Launch Immunology",
                    "apprvd_product_cd": "GAM2",
                    "apprvd_product_nm": "UC_DSA"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "IAE Rheum Branded Portfolio",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "Rheum Branded Portfolio"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Linzess_CIC-FC"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Linzess_IBS-C"
                },
                {
                    "brand_nm": "Depakote",
                    "sub_brand": "Depakote/Migraine",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Depakote_Migraine"
                },
                {
                    "brand_nm": "Synthroid",
                    "sub_brand": "Synthroid Branded Only",
                    "apprvd_product_cd": "MET0",
                    "apprvd_product_nm": "Synthroid"
                },
                {
                    "brand_nm": "Mavyret",
                    "sub_brand": "Overview Hepatology Ambassador Prgm",
                    "apprvd_product_cd": "HCVB1",
                    "apprvd_product_nm": "HCV_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Avycaz_HABP_VABP"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "NDO_DSA"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Skyrizi/Crohns",
                    "apprvd_product_cd": "PRIA0",
                    "apprvd_product_nm": "Skyrizi_CD"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Skyrizi_PS_Rheum"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "viekira_XR_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Avycaz_cUTI"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "OAB_DSA"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "Botox OAB",
                    "apprvd_product_cd": "BXURO",
                    "apprvd_product_nm": "Botox_OAB"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "IAE Value Based Care AD",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "Value Based Care AD"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview AS Advocate Program",
                    "apprvd_product_cd": "PRIMV",
                    "apprvd_product_nm": "Humira_AS_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Tricor_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Vicoprofen_IMHC_DSA"
                },
                {
                    "brand_nm": "Mavyret",
                    "sub_brand": "Mavyret",
                    "apprvd_product_cd": "HCVDC",
                    "apprvd_product_nm": "Mavyret"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "cUTI_DSA"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "Botox NDO",
                    "apprvd_product_cd": "BXURO",
                    "apprvd_product_nm": "Botox_NDO"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "SB_DSA"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "Botox Blepharospasm",
                    "apprvd_product_cd": "BXSMD",
                    "apprvd_product_nm": "Botox_SB"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Vicoprofen_IMHC"
                },
                {
                    "brand_nm": "General DSA",
                    "sub_brand": "IAE Value Based Care",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "IMM Value Based Care"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/JIA",
                    "apprvd_product_cd": "AI0R",
                    "apprvd_product_nm": "Humira_JIA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Trilipix"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "GBM_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Avycaz_cIAI"
                },
                {
                    "brand_nm": "Vuity",
                    "sub_brand": "Vuity",
                    "apprvd_product_cd": "MCK0",
                    "apprvd_product_nm": "Vuity"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview JIA Advocate Program",
                    "apprvd_product_cd": "PRIMV",
                    "apprvd_product_nm": "Humira_JIA_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Trilipix_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Lung_Ca_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Lupron_UF"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview RA Advocate Program",
                    "apprvd_product_cd": "PRIMV",
                    "apprvd_product_nm": "Humira_RA_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Niaspan_DSA"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "My Humira Program Services",
                    "apprvd_product_cd": "PRPAT",
                    "apprvd_product_nm": "Humira Complete_Patient Services"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Zinbryta"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Taytulla"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "Botox Cervical Dystonia",
                    "apprvd_product_cd": "BXSMD",
                    "apprvd_product_nm": "Botox_CDYS"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq/Crohns",
                    "apprvd_product_cd": "AI4",
                    "apprvd_product_nm": "Rinvoq_CD"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "MDS_DSA"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Ped CD",
                    "apprvd_product_cd": "PRIA0",
                    "apprvd_product_nm": "Humira_Ped_CD"
                },
                {
                    "brand_nm": "Creon",
                    "sub_brand": "PAE CREON Branded",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Creon"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "cIAI_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "IBD_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "CSYS_DSA"
                },
                {
                    "brand_nm": "Qulipta",
                    "sub_brand": "Qulipta",
                    "apprvd_product_cd": "CNSM0",
                    "apprvd_product_nm": "Qulipta"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Glaucoma_Gans"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview Gastro Ped CD Ambassador Program",
                    "apprvd_product_cd": "AI0PL",
                    "apprvd_product_nm": "Humira_Ped_CD_DSA"
                },
                {
                    "brand_nm": "Creon",
                    "sub_brand": "PAE EPI DSA",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Creon_DSA"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Skyrizi/PsA Derm",
                    "apprvd_product_cd": "AI7",
                    "apprvd_product_nm": "Skyrizi_PsA_Derm"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Myelofibrosis_DSA"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "IAE Value Based Care Ps/PsA",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "Value Based Care Ps/PsA"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Ankylosing Spondylitis",
                    "apprvd_product_cd": "AI0R",
                    "apprvd_product_nm": "Humira_AS"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Tricor"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Hypertension_DSA"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "pJIA DSA",
                    "apprvd_product_cd": "AI2",
                    "apprvd_product_nm": "pJIA_DSA"
                },
                {
                    "brand_nm": "Vraylar",
                    "sub_brand": "Vraylar FAS",
                    "apprvd_product_cd": "VFAS1",
                    "apprvd_product_nm": "Vraylar"
                },
                {
                    "brand_nm": "Namzaric",
                    "sub_brand": "Namzaric",
                    "apprvd_product_cd": "INS5",
                    "apprvd_product_nm": "Namzaric"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "RA_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Viekira_Pak"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Skyrizi/Ulcerative Colitis",
                    "apprvd_product_cd": "AI4",
                    "apprvd_product_nm": "Skyrizi_UC"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq/pJIA",
                    "apprvd_product_cd": "AI2",
                    "apprvd_product_nm": "Rinvoq_pJIA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "General_Elagolix_Education"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "BP1_DSA"
                },
                {
                    "brand_nm": "EPKINLY",
                    "sub_brand": "EPKINLY Marketing Materials_FL",
                    "apprvd_product_cd": "PHEM1",
                    "apprvd_product_nm": "Epkinly_FL"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq/Rheumatoid Arthritis",
                    "apprvd_product_cd": "AI2",
                    "apprvd_product_nm": "Rinvoq_RA"
                },
                {
                    "brand_nm": "EPKINLY",
                    "sub_brand": "EPKINLY/DLBCL",
                    "apprvd_product_cd": "PHEM0",
                    "apprvd_product_nm": "EPKINLY"
                },
                {
                    "brand_nm": "Emrelis",
                    "sub_brand": "Emrelis_NSCLC",
                    "apprvd_product_cd": "ODL1",
                    "apprvd_product_nm": "Emrelis"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Biaxin_IMHC"
                },
                {
                    "brand_nm": "Ultane",
                    "sub_brand": "Ultane/Anesthesia",
                    "apprvd_product_cd": "EPAC0",
                    "apprvd_product_nm": "Ultane"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/PsA",
                    "apprvd_product_cd": "AI0R",
                    "apprvd_product_nm": "Humira_PsA"
                },
                {
                    "brand_nm": "Emblaveo",
                    "sub_brand": "Emblaveo",
                    "apprvd_product_cd": "LAI0",
                    "apprvd_product_nm": "Emblaveo"
                },
                {
                    "brand_nm": "Vraylar",
                    "sub_brand": "Vraylar_BPDO",
                    "apprvd_product_cd": "CNSP0",
                    "apprvd_product_nm": "Vraylar_BPDO"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Atopic Dermatitis DSA",
                    "apprvd_product_cd": "AI0AD",
                    "apprvd_product_nm": "AD_DSA"
                },
                {
                    "brand_nm": "Uterine Fibroids DSA",
                    "sub_brand": "Uterine Fibroids DSA",
                    "apprvd_product_cd": "MCK0",
                    "apprvd_product_nm": "Fibroids_DSA"
                },
                {
                    "brand_nm": "Duopa",
                    "sub_brand": "Overview Neuroscience Advocate Program",
                    "apprvd_product_cd": "NPDV0",
                    "apprvd_product_nm": "Duopa_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Tarka_IMHC"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq/PsA",
                    "apprvd_product_cd": "AI0I",
                    "apprvd_product_nm": "Rinvoq_PsA"
                },
                {
                    "brand_nm": "Elahere",
                    "sub_brand": "Elahere FAS",
                    "apprvd_product_cd": "IFAS0",
                    "apprvd_product_nm": "Elahere"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Presbyopia_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Vraylar_BP1"
                },
                {
                    "brand_nm": "Bystolic",
                    "sub_brand": "Bystolic",
                    "apprvd_product_cd": "MCK0",
                    "apprvd_product_nm": "Bystolic"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Skyrizi Complete",
                    "apprvd_product_cd": "ISF1",
                    "apprvd_product_nm": "Skyrizi_Complete_Patient_Services"
                },
                {
                    "brand_nm": "Lastacaft",
                    "sub_brand": "Lastacaft_OTC",
                    "apprvd_product_cd": "SEC0",
                    "apprvd_product_nm": "Lastacaft_OTC"
                },
                {
                    "brand_nm": "Lupron",
                    "sub_brand": "Lupron/Ped DSA",
                    "apprvd_product_cd": "ACP0",
                    "apprvd_product_nm": "Lupron_PD_DSA"
                },
                {
                    "brand_nm": "Zemplar IV",
                    "sub_brand": "Zemplar IV/Stage 5",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Zemplar"
                },
                {
                    "brand_nm": "Savella",
                    "sub_brand": "Savella",
                    "apprvd_product_cd": "INS5",
                    "apprvd_product_nm": "Savella"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "SCZ_DSA"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "Botox TX",
                    "apprvd_product_cd": "BXND0",
                    "apprvd_product_nm": "Botox_Therapeutic"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/PsA Derm",
                    "apprvd_product_cd": "AI7",
                    "apprvd_product_nm": "Humira_PsA_Derm"
                },
                {
                    "brand_nm": "Lupaneta",
                    "sub_brand": "Lupaneta Pack/Endometriosis",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Lupaneta_Pack"
                },
                {
                    "brand_nm": "Lupron",
                    "sub_brand": "Lupron/Ped",
                    "apprvd_product_cd": "ACP0",
                    "apprvd_product_nm": "Lupron_PD"
                },
                {
                    "brand_nm": "Skyrizi/Rinvoq",
                    "sub_brand": "IAE Gastro Branded Portfolio",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "Gastro Branded Portfolio"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Lupron_Gyn_DSA"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Skyrizi/Psoriasis",
                    "apprvd_product_cd": "AI7",
                    "apprvd_product_nm": "Skyrizi_Ps"
                },
                {
                    "brand_nm": "General DSA",
                    "sub_brand": "General Healthcare Education",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "General_Healthcare_Education"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "BP1_Ped_DSA"
                },
                {
                    "brand_nm": "Lupron",
                    "sub_brand": "Lupron/Uro",
                    "apprvd_product_cd": "URO1",
                    "apprvd_product_nm": "Lupron_Uro"
                },
                {
                    "brand_nm": "Depakote",
                    "sub_brand": "Depakote/Bipolar DSA",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Depakote_Bipolar_DSA"
                },
                {
                    "brand_nm": "Oriahnn",
                    "sub_brand": "Oriahnn/Fibroids",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Oriahnn"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Vraylar_SCZ"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "CABP_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "PsA_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Moderiba_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Gengraf_KLHTransplant_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "ABSSSI_Ped_DSA"
                },
                {
                    "brand_nm": "Skyrizi/Rinvoq",
                    "sub_brand": "IAE Value Based Care Rheum",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "Value Based Care Rheum"
                },
                {
                    "brand_nm": "Viibryd",
                    "sub_brand": "Viibryd",
                    "apprvd_product_cd": "CNSP0",
                    "apprvd_product_nm": "Viibryd"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "MDD_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Teflaro_CABP"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Ps_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Moderiba"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Gengraf_KLHTransplant"
                },
                {
                    "brand_nm": "Lupron",
                    "sub_brand": "Lupron/Endometriosis",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Lupron_Gyn"
                },
                {
                    "brand_nm": "Skyrizi/Rinvoq",
                    "sub_brand": "IAE Derm Branded Portfolio",
                    "apprvd_product_cd": "AI20",
                    "apprvd_product_nm": "Derm Branded Portfolio"
                },
                {
                    "brand_nm": "Lupron",
                    "sub_brand": "Lupron/Uro DSA",
                    "apprvd_product_cd": "URO1",
                    "apprvd_product_nm": "Lupron_Uro_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "AndroGel"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Ulcerative Colitis",
                    "apprvd_product_cd": "AI4",
                    "apprvd_product_nm": "Humira_UC"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Eylocity"
                },
                {
                    "brand_nm": "Vyalev",
                    "sub_brand": "Vyalev APD",
                    "apprvd_product_cd": "NAE1",
                    "apprvd_product_nm": "Vyalev"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Saphris"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "Botox CM",
                    "apprvd_product_cd": "BXCM",
                    "apprvd_product_nm": "Botox_CM"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview Gastro CD Advocate Program",
                    "apprvd_product_cd": "PRIMV",
                    "apprvd_product_nm": "Humira_CD_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Nimbex_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Mivacron_DSA"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview Uveitis Ambassador Program",
                    "apprvd_product_cd": "AI0PL",
                    "apprvd_product_nm": "Humira_Uv_DSA"
                },
                {
                    "brand_nm": "Kaletra",
                    "sub_brand": "Kaletra/HIV",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Kaletra"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "IBS-D_DSA"
                },
                {
                    "brand_nm": "Alphagan",
                    "sub_brand": "Alphagan",
                    "apprvd_product_cd": "MCK0",
                    "apprvd_product_nm": "Alphagan"
                },
                {
                    "brand_nm": "Liletta",
                    "sub_brand": "Liletta Branded",
                    "apprvd_product_cd": "INS6",
                    "apprvd_product_nm": "Liletta"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Hidradenitis Suppurativa",
                    "apprvd_product_cd": "AI0D",
                    "apprvd_product_nm": "Humira_HS"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Marinol_DSA"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview Dermatology Advocate Program",
                    "apprvd_product_cd": "PRIMV",
                    "apprvd_product_nm": "Humira_Ps_DSA"
                },
                {
                    "brand_nm": "Ovarian Cancer_DSA",
                    "sub_brand": "Ovarian Cancer DSA",
                    "apprvd_product_cd": "PRON2",
                    "apprvd_product_nm": "Ovarian Cancer_DSA"
                },
                {
                    "brand_nm": "Combigan",
                    "sub_brand": "Combigan",
                    "apprvd_product_cd": "MCK0",
                    "apprvd_product_nm": "Combigan"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Ped UC DSA",
                    "apprvd_product_cd": "AI4",
                    "apprvd_product_nm": "Ped_UC_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "AndroGel_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "FL_DSA"
                },
                {
                    "brand_nm": "Viberzi",
                    "sub_brand": "Viberzi Branded",
                    "apprvd_product_cd": "GC0A",
                    "apprvd_product_nm": "Viberzi"
                },
                {
                    "brand_nm": "Botox",
                    "sub_brand": "CM DSA",
                    "apprvd_product_cd": "BXCM",
                    "apprvd_product_nm": "CM_DSA"
                },
                {
                    "brand_nm": "DLBCL_DSA",
                    "sub_brand": "DLBCL DSA ONE",
                    "apprvd_product_cd": "ONE1",
                    "apprvd_product_nm": "DLBCL_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "DED_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Botox_Uro_DSA"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview Gastro UC Advocate Program",
                    "apprvd_product_cd": "PRIMV",
                    "apprvd_product_nm": "Humira_UC_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Prometrium_IMHC"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Hidradenitis Suppurativa DSA",
                    "apprvd_product_cd": "AI0D",
                    "apprvd_product_nm": "Humira_HS_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Prometrium_IMHC_DSA"
                },
                {
                    "brand_nm": "Lumigan",
                    "sub_brand": "Lumigan",
                    "apprvd_product_cd": "SEC0",
                    "apprvd_product_nm": "Lumigan"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq/Ankylosing Spondylitis",
                    "apprvd_product_cd": "AI2R",
                    "apprvd_product_nm": "Rinvoq_AS"
                },
                {
                    "brand_nm": "Skyrizi",
                    "sub_brand": "Skyrizi Gastro Product Education",
                    "apprvd_product_cd": "GAM1",
                    "apprvd_product_nm": "Skyrizi_Gastro_Product_Education"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "GCA_DSA"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Crohns",
                    "apprvd_product_cd": "AI5",
                    "apprvd_product_nm": "Humira_CD"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Biaxin_IMHC_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "CLL_Disease_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Marinol"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Psoriasis",
                    "apprvd_product_cd": "AI0D",
                    "apprvd_product_nm": "Humira_Ps"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Teliso-V"
                },
                {
                    "brand_nm": "Vraylar",
                    "sub_brand": "Vraylar_aMDD",
                    "apprvd_product_cd": "CNSP0",
                    "apprvd_product_nm": "Vraylar_aMDD"
                },
                {
                    "brand_nm": "Linzess",
                    "sub_brand": "Linzess Branded",
                    "apprvd_product_cd": "GC0A",
                    "apprvd_product_nm": "Linzess"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "MS_DSA"
                },
                {
                    "brand_nm": "Ozurdex",
                    "sub_brand": "Ozurdex",
                    "apprvd_product_cd": "REC1",
                    "apprvd_product_nm": "Ozurdex"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Ultane_DSA"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Overview PSA Advocate Program",
                    "apprvd_product_cd": "PRIMV",
                    "apprvd_product_nm": "Humira_PsA_DSA"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq/GCA",
                    "apprvd_product_cd": "AI2",
                    "apprvd_product_nm": "Rinvoq_GCA"
                },
                {
                    "brand_nm": "InFeD",
                    "sub_brand": "INFeD/Iron Deficiency",
                    "apprvd_product_cd": "INS11",
                    "apprvd_product_nm": "INFeD"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq/Atopic Dermatitis",
                    "apprvd_product_cd": "AI0AD",
                    "apprvd_product_nm": "Rinvoq_AD"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "IOP_DSA"
                },
                {
                    "brand_nm": "Lo_Loestrin",
                    "sub_brand": "Lo_Loestrin Branded",
                    "apprvd_product_cd": "INS6",
                    "apprvd_product_nm": "Lo_Loestrin"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Humira/Ped UC",
                    "apprvd_product_cd": "AI4",
                    "apprvd_product_nm": "Humira_Ped_UC"
                },
                {
                    "brand_nm": "Retina_Unbranded_DSA",
                    "sub_brand": "Retina Unbranded",
                    "apprvd_product_cd": "REC1",
                    "apprvd_product_nm": "Retina_Unbranded_DSA"
                },
                {
                    "brand_nm": "Refresh",
                    "sub_brand": "Refresh (OTC)",
                    "apprvd_product_cd": "RC1",
                    "apprvd_product_nm": "Refresh_OTC"
                },
                {
                    "brand_nm": "Zemplar",
                    "sub_brand": "Zemplar/DSA",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Zemplar_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "K-Tab_IMHC_DSA"
                },
                {
                    "brand_nm": "Duopa",
                    "sub_brand": "Duopa",
                    "apprvd_product_cd": "NAE1",
                    "apprvd_product_nm": "Duopa"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "SLL_DSA"
                },
                {
                    "brand_nm": "Fetzima",
                    "sub_brand": "Fetzima",
                    "apprvd_product_cd": "INS3",
                    "apprvd_product_nm": "Fetzima"
                },
                {
                    "brand_nm": "Xen",
                    "sub_brand": "Xen",
                    "apprvd_product_cd": "XEC1",
                    "apprvd_product_nm": "Xen"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "DME_DSA"
                },
                {
                    "brand_nm": "Nimbex",
                    "sub_brand": "Nimbex/ICU",
                    "apprvd_product_cd": "EPAC0",
                    "apprvd_product_nm": "Nimbex"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Saphris_BP1"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Multichannel"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Technivie"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Tarka_IMHC_DSA"
                },
                {
                    "brand_nm": "Kaletra",
                    "sub_brand": "Kaletra/DSA",
                    "apprvd_product_cd": "PRSR0",
                    "apprvd_product_nm": "Kaletra_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Lupaneta_Pack_DSA"
                },
                {
                    "brand_nm": "NSCLC_DSA",
                    "sub_brand": "NSCLC DSA",
                    "apprvd_product_cd": "ODL1",
                    "apprvd_product_nm": "NSCLC_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "RVO_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Saphris_SCZ"
                },
                {
                    "brand_nm": "Restasis",
                    "sub_brand": "Restasis",
                    "apprvd_product_cd": "SECB",
                    "apprvd_product_nm": "Restasis"
                },
                {
                    "brand_nm": "Linzess",
                    "sub_brand": "PAE IBS-C/CIC DSA",
                    "apprvd_product_cd": "DAE1",
                    "apprvd_product_nm": "IBS-C_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Uveitis_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "AS_DSA"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "K-Tab_IMHC"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Viekira_Pak_DSA"
                },
                {
                    "brand_nm": "Venclexta",
                    "sub_brand": "Venclexta/AML",
                    "apprvd_product_cd": "ONH2",
                    "apprvd_product_nm": "Venclexta"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Mivacron"
                },
                {
                    "brand_nm": "Rinvoq",
                    "sub_brand": "Rinvoq Complete",
                    "apprvd_product_cd": "ISF0",
                    "apprvd_product_nm": "Rinvoq_Complete_Patient_Services"
                },
                {
                    "brand_nm": "Humira",
                    "sub_brand": "Built on Humira",
                    "apprvd_product_cd": "AI8",
                    "apprvd_product_nm": "Built_On_Humira"
                },
                {
                    "brand_nm": null,
                    "sub_brand": null,
                    "apprvd_product_cd": null,
                    "apprvd_product_nm": "Alz_Dem_DSA"
                }
            ],
            "territory_data": null,
            "owned_or_leased": "owned"
        }
    ],
    "errors": null
}

var mockERARHCPResponse = {"status": "SUCCESS", "statusCode": 200, "content": {"status": "SUCCESS"}, "errors": null}

/**
 * prefillTeatmentJourney
 * @name prefillTeatmentJourney
 * @param {object} section
 */
function prefillTeatmentJourney(section) {
    var indication = baseGetCookieValue('indicationId');
    if (indication) {
        diagnosisName.value = indication;
        var indicationNames = [' Adult Spasticity (age 18+).', ' Pediatric Spasticity (age 2-17).', ' Blepharospasm (age 12+).', ' Cervical Dystonia (age 16+).', ' Chronic Migraine (age 18+).', ' Adult Overactive Bladder (age 18+).', ' Adult Overactive Bladder due to a Neurologic Condition (age 18+).', ' Pediatric Overactive Bladder due to a Neurologic Condition (age 5-17).', ' Severe Underarm Sweating (age 18+).', ' Strabismus (age 12+).'];
        var journeyRadioGroup = $('.treatmentJourneyRb .guideRadioButtonGroupItems .guideRadioButtonItem').find('label');
        journeyRadioGroup.each(function (index, elem) {
            $(elem).append(indicationNames[parseInt(indication, 10) - 1]);
        });
    }
    decryptResponseGcm('admp_gp').then(function (decryptedData) {
        let result = JSON.parse(decryptedData);
        if (result.isStatusSuccessful === 'true') {
            if (result.treatmentJourney && result.treatmentJourney.length && result.treatmentJourney[0].treatmentJourney) {
                section.treatmentJourneyRb.value = result.treatmentJourney[0].treatmentJourney;
            }
            if (result.patientType === 'Caregiver') {
                section.treatmentJourneyCaregiverText.visible = true;
            }
        }
    });

}


/**
 * prefillInsuranceCoverage
 * @name prefillInsuranceCoverage
 * @param {object} section
 */
function prefillInsuranceCoverage(section) {
    decryptResponseGcm('admp_gp').then(function (decryptedData) {
        var result = JSON.parse(decryptedData);
        if (result.isStatusSuccessful === 'true') {
            prefillPatientSurveyQuestions(result, section.campaignsQuestions);
        }
        if (result.patientType === 'Caregiver') {
            section.careGiverSavingsEligibilityText.visible = true;
        }
    });
}

/**
 * prefillMobileNumber
 * @name prefillMobileNumber
 * @param {object}  mobileNumber
 * @param {string} formType
 * @param {object} smsOptin
 */
function prefillMobileNumber(mobileNumber, formType, smsOptin) {
    decryptResponseGcm('admp_gp').then(function (decryptedData) {
        var result = JSON.parse(decryptedData);
        if (result.isStatusSuccessful === 'true' && result.phone && result.phone.length) {
            var phoneList = result.phone;
            for (var i = 0; i < phoneList.length; i++) {
                if (phoneList[i].phoneType === 'Mobile') {
                    mobileNumber.value = phoneList[i].phoneNumber;
                    if (formType === 'treatment-reminders') {
                        smsOptin.visible = true;
                    }
                }
            }
        }
    });
}

/**
 * setValueFromCookie
 * @name setValueFromCookie
 * @param {object} usmMyRadioButton
 * @param {string} cookieString
 * @param {object} inputField
 * @param {string} expectedValue
 * @param {scope} globals
 */
function setValueFromCookie(usmMyRadioButton, cookieString, inputField, expectedValue, globals) {
    if (usmMyRadioButton.$value === expectedValue && baseGetCookieValue(cookieString)) {
        globals.functions.setProperty(inputField, {'value': cookieString});
    }
}

/**
 * prefillMyProfileSectionBotox
 * @name prefillMyProfileSectionBotox
 * @param {object} section
 * @param {scope} globals
 */
function prefillMyProfileSectionBotox(section, globals) {
    decryptResponseGcm('admp_gp').then(function (decryptedData) {
        var result = JSON.parse(decryptedData);
        if (!result) return;

        function setIfExists(value, target, prop) {
            if (value) {
                globals.functions.setProperty(target, {'value': value});
            }
        }

        setIfExists(result.externalPatientId, section.externalPatientId);
        setIfExists(result.patientType, section.patientOrCaregiverRadio);
        setIfExists(result.firstName, section.firstNameTextbox);
        setIfExists(result.lastName, section.lastNameTextbox);

        if (result.email && result.email.length && result.email[0].emailAddress) {
            globals.functions.setProperty(section.emailPanel.emailTextbox, {'value': result.email[0].emailAddress});
            globals.functions.setProperty(section.userName, {'value': result.email[0].emailAddress});
        }

        if (
            result.patientTherapy.length &&
            result.patientTherapy[0].diagnosis.length &&
            result.patientTherapy[0].diagnosis[0].diagnosisName
        ) {
            var primaryCondition = section.patientTherapy.diagnosis.diagnosisName;
            globals.functions.setProperty(primaryCondition, {'value': result.patientTherapy[0].diagnosis[0].diagnosisName});
            section.patientOrCaregiverRadio.visible = ["1", "2", "8"].includes(primaryCondition.value);

            var treatmentJourneyOptions = {
                "Journey1": "I'm diagnosed with",
                "Journey2": "I will be starting BOTOX® treatment for",
                "Journey3": "I have started BOTOX® treatment for",
                "Journey4": "I am here to learn about"
            };
            var postfixKey = primaryCondition.jsonModel.options[primaryCondition.value - 1].split(primaryCondition.value + '=')[1] + ".";
            basePopulateDropDownValues(section.treatmentJourneyPanel.treatmentJourneydropDown, treatmentJourneyOptions, "", postfixKey);
        }

        if (
            result.treatmentJourney &&
            result.treatmentJourney.length &&
            result.treatmentJourney[0].treatmentJourney
        ) {
            globals.functions.setProperty(section.treatmentJourneyPanel.treatmentJourneydropDown, {'value': result.treatmentJourney[0].treatmentJourney});
        }

        prefillPatientSurveyQuestions(result, section);
    });
}

/**
 * botoxInit
 * @name botoxInit
 */
function botoxInit() {
    abbvBotoxPatient.init();
    //abbvBotoxPatient.getprofile("simon.meier@ajila.com", 'dashboardPath');
}

/*$(function () {
    abbvBotoxPatient.init();
    //abbvBotoxPatient.getprofile("simon.meier@ajila.com", 'dashboardPath');
});*/

/**
 * prefillMobileNumberCR
 * @name prefillMobileNumberCR
 * @param mobileNumber
 * @param formType
 * @param smsOptin
 * @param {scope} globals
 */
function prefillMobileNumberCR(mobileNumber, formType, smsOptin, globals) {
    decryptResponseGcm('admp_gp').then(function (decryptedData) {
        var result = JSON.parse(decryptedData);
        if (result.isStatusSuccessful !== 'true') return;

        var phoneList = result.phone;
        if (!phoneList || !phoneList.length) {
            smsOptin.visible = true;
            return;
        }

        var mobilePhoneNumber = null;
        for (var i = 0; i < phoneList.length; i++) {
            if (phoneList[i].phoneType === 'Mobile') {
                mobilePhoneNumber = phoneList[i].phoneNumber;
                break;
            }
        }

        if (mobilePhoneNumber) {
            globals.functions.setProperty(mobileNumber, {'value': mobilePhoneNumber});
            smsOptin.visible = formType !== 'treatment-reminders';
        } else {
            smsOptin.visible = true;
        }
    });
}

/**
 * prefillupdateRemindersCR
 * @name prefillupdateRemindersCR
 * @param section
 * @param {scope} globals
 */
function prefillupdateRemindersCR(section, globals) {
    decryptResponseGcm('admp_gp').then(function (decryptedData) {
        var result = JSON.parse(decryptedData);
        if (!result || result.isStatusSuccessful !== 'true') return;

        setLastTreatmentDate(result);
        setReminderPhone(result);
    });

    function setLastTreatmentDate(result) {
        var therapy = result.patientTherapy || [];
        var diagnosis = therapy[0] && therapy[0].diagnosis && therapy[0].diagnosis[0];
        if (!diagnosis || !diagnosis.dateofLastTreatment) return;

        var parts = diagnosis.dateofLastTreatment.split("/");
        if (parts.length === 3) {
            var rearrangedDate = parts[2] + '-' + parts[0] + '-' + parts[1];
            globals.functions.setProperty(
                section.calenderPanel.patientTherapy.diagnosisPanel.appointementDatePicker,
                {value: rearrangedDate}
            );
        }

        if (result.treatmentReminders && result.treatmentReminders.length && result.treatmentReminders[0].frequency) {
            section.phoneDetails.remaindersTimeSpanDropDown.value = parseInt(result.treatmentReminders[0].frequency, 10);
        }
    }

    function setReminderPhone(result) {
        var panel = section.phoneDetails.smsOptinPanel;
        var reminderPhone = (result.treatmentReminders && result.treatmentReminders.length && result.treatmentReminders[0].phone) || '';
        var phone = reminderPhone;

        if (!phone && result.phone && result.phone.length) {
            var mobile = null;
            for (var i = 0; i < result.phone.length; i++) {
                if (result.phone[i].phoneType === 'Mobile') {
                    mobile = result.phone[i];
                    break;
                }
            }
            if (mobile) phone = mobile.phone;
        }

        if (phone) {
            globals.functions.setProperty(panel.mobileNumberTextbox, {value: phone});
            panel.visible = false;
        } else {
            panel.visible = true;
        }
    }
}

/**
 * startTimer
 * @name startTimer
 * @param time
 * @param timeType
 * @param classname
 */
function startTimer(time, timeType, classname) {
    var seconds = timeType == 'hours' ? time * 60 * 60 : (timeType == 'minutes' ? time * 60 : time);
    var countDownDate = new Date().getTime() + (seconds * 1000);
    var interval = setInterval(function () {
        var now = new Date().getTime();
        var distance = countDownDate - now;
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var timerSeconds = Math.floor((distance % (1000 * 60)) / 1000);
        var timerDisplay = getTimeStructureToDisplay(timeType, hours, minutes, timerSeconds);
        if (!$('.' + classname).find('p').length > 0) {
            var pTag = $('<p class="abbv_countdown"></p>');
            var clockIcon = $('<p class="abbv_clock"></p>');
            $('.' + classname).append(clockIcon);
            $('.' + classname).append(pTag);
        }
        $('.' + classname + ' p.abbv_countdown').text(timerDisplay);
        if (distance < 0) {
            clearInterval(interval);
            var defaultTime = timeType == 'hours' ? '00:00:00' : (timeType == 'minutes' ? '00:00' : '00');
            $('.' + classname + ' p.abbv_countdown').addClass('abbv_countdown_end').text(defaultTime);
        }
    }, 1000);
}

function getTimeStructureToDisplay(timeType, hours, minutes, seconds) {
    var timerDisplay;
    switch (timeType) {
        case 'hours' :
            timerDisplay = (hours < 10 ? '0' + hours : hours) + ':' +
                (minutes < 10 ? '0' + minutes : minutes) + ':' +
                (seconds < 10 ? '0' + seconds : seconds);
            break;

        case 'minutes' :
            timerDisplay = (minutes < 10 ? '0' + minutes : minutes) + ':' +
                (seconds < 10 ? '0' + seconds : seconds);
            break;
        case 'seconds' :
            timerDisplay = (seconds < 10 ? '0' + seconds : seconds);
            break;
    }
    return timerDisplay;
}

/**
 * prefillCalculatedFutureDate
 * @name prefillCalculatedFutureDate
 * @param {object} dateField
 * @param {scope} globals
 */
function prefillCalculatedFutureDate(dateField, globals) {
    decryptResponseGcm('admp_gp').then(function(decryptedData) {
        var result = JSON.parse(decryptedData);
        var  months = parseInt(result.treatmentReminders[0].frequency);
        var dateofLastTreatment = result.patientTherapy[0].diagnosis[0].dateofLastTreatment;
        var dateParts = dateofLastTreatment.split("/");
        var date = new Date(Date.UTC(dateParts[2], dateParts[0]-1, dateParts[1]));
        date.setMonth(date.getMonth() + months);
        var futureDateValue = date.toJSON().split('T')[0];
        globals.functions.setProperty(dateField, {value: futureDateValue});
    });
}

/**
 * prefillProspectProfileSectionBotox
 * @name prefillProspectProfileSectionBotox
 * @param {object} section
 * @param {scope} globals
 */
function prefillProspectProfileSectionBotox(section, globals) {
    decryptResponseGcm('admp_gp').then(function(decryptedData) {
        var result = JSON.parse(decryptedData);
        if (!result) return;

        function setIfExists(value, target, prop) {
            if (value && target) {
                globals.functions.setProperty(target, {
                    'value': value
                });
            }
        }
        setIfExists(result.externalPatientId, section.externalPatientId);
        setIfExists(result.patientType, section.patientOrCaregiverRadio);
        setIfExists(result.firstName, section.firstNameTextbox);
        setIfExists(result.lastName, section.lastNameTextbox);

        if (result.email && result.email.length && result.email[0].emailAddress) {
            globals.functions.setProperty(section.emailPanel.emailTextbox, { 'value': result.email[0].emailAddress });
            globals.functions.setProperty(section.userName, { 'value': result.email[0].emailAddress });
        }
        if (result.patientType && result.patientType.length) {
            globals.functions.setProperty(section.patientOrCaregiverRadio, { visible: true });
        } else {
            globals.functions.setProperty(section.patientOrCaregiverRadio, { visible: false });
        }
    });
}
/**
 * Function to replace special characters with superscript.
 * @name baseReplaceSpecialCharacters
 * @param {scope} globals
 * @description Iterates through quiz question elements and generates DDG quiz objects.
 */
function baseReplaceSpecialCharacters() {
    baseReplaceSpecialCharactersByCssClass('abbv-special-chars');
}

/**
 * Function to set DDG quiz questions.
 * @name setLoloDDGQuestions
 * @param {scope} globals
 * @description Iterates through quiz question elements and generates DDG quiz objects.
 */
function setLoloDDGQuestions(globals) {
    var questions = $('.cmp-container').find('[class*="abbv-quizddg-qtoken-q"]');
    $(questions).each(function (index, question) {
        generateDDgQuizObject(question);
    });
}

// Function to validate all checkboxes in the panel
function validateAllFormCheckboxes() {
    var isValid = true;
    var formCheckboxes = $('.cmp-container').find('[class*="abbv-quizddg-panel-q"]');
    if (formCheckboxes.length > 0) {
        $.each(formCheckboxes, function (index, item) {
            if (($(item).find("input:checked").length < 1) && ($(item).is(":visible"))) {
                $(item).removeClass('validation-success').addClass('validation-failure');
                $(item).find('.errormessage').show();
                $('.q1Errortext.errormessage').show();
                var iframeTop = $(window.parent.document).find('.cmp-adaptiveform-container').offset().top;
                $('html, body', window.parent.document).animate({scrollTop: (iframeTop + 10)}, 350);
                isValid = false;
            } else {
                $(item).removeClass('validation-failure').addClass('validation-success');
                $(item).find('.errormessage').hide();
                $('.q1Errortext.errormessage').hide();
                isValid = true;
            }
        });
    }
    return isValid;
}

/**
 * mobileWalletLandingFormInitialize
 * @name mobileWalletLandingFormInitialize
 * @description Initializes form mobile-wallet-landing-form.
 * @param {object} [transactionName] TransactionName is optional, applicable for EAPI
 * @param {scope} globals
 */
function mobileWalletLandingFormInitialize(transactionName,  globals) {
    showLoader(true);

    if (baseUrlGetParam('cardid') !== "" && baseUrlGetParam('groupNumber') !== "") {
        var cardid = baseUrlGetParam('cardid');
        var groupNumber = baseUrlGetParam('groupNumber');

        var copayCardObject = {};
        copayCardObject.isSuccess = "true";
        copayCardObject.rxIdentifier = cardid;
        copayCardObject.rxGroup = groupNumber;
        copayCardObject.rxBIN = "004682";
        copayCardObject.rxPCN = "CN";
        copayCardObject.suf = "01";

        //convert object to json string
        var coPayString = JSON.stringify(copayCardObject);

        localStorage.setItem("admp_cci", coPayString);
    }

    var result = JSON.parse(localStorage.getItem("admp_cci"));
    if (result === null) {
        var obj = getQueryVariable('requestData').replaceAll('%2522', '"').replaceAll('%22','"').replaceAll('%7B', '{').replaceAll('%5C', '\\').replaceAll('%7D', '}');
        var requestObj = JSON.parse(obj);
        result = JSON.parse(requestObj.copayDetails);
    }
    var transactionName = (transactionName && transactionName.$value) ? transactionName.$value : '';
    generatePass(result, "savingscard", transactionName, globals);
}

/* Apple Google wallet Submit event */
function generatePass(result, fileName, transactionName, globals) {
        var deviceType;
        var userAgent = navigator.userAgent;
        if (/android/i.test(userAgent)) {
            deviceType = "google";
        }
        if (/iPhone/.test(userAgent) && !userAgent.includes('Macintosh')) {
            deviceType = "apple";
        }
        var cardDetails = result ? (result.ContentResult ? result.ContentResult.CopayCard : result) : {};
        var requestData = {
            brandName: globals.form.$properties.brandName,
            apiType: globals.form.$properties.apiType,
            copayDetails: JSON.stringify(cardDetails),
            formAction: 'MobileWallet',
            mobileType: deviceType,
            fileName: fileName,
            version: globals.form.$properties.version,
            transactionName: transactionName
        };

        var serviceURI = "/abbviecloud/bin/abbvie/mobilewallet";

        if (deviceType == 'google') {
            $.ajax({
                type: 'GET',
                url: serviceURI,
                async: true,
                dataType: 'json',
                data: {
                    'requestData': JSON.stringify(requestData)
                },
                success: function(response) {
                    if (response) {
                        if (typeof response === 'object' && response.ErrorResponseMessageList) {
                            baseHandleErrorResponse(response);
                        } else {
                            window.parent.location.href = response.ContentResult || response.jwtToken;
                        }
                    }
                },
                error: function(error) {
                    console.log(error.message);
                }
            });
        } else {
            var form = document.createElement('form');
            form.setAttribute('method', 'get');
            form.setAttribute('action', serviceURI);
            var data = document.createElement('input');
            data.setAttribute('type', 'hidden');
            data.setAttribute('name', 'requestData');
            data.setAttribute('value', JSON.stringify(requestData));
            form.appendChild(data);
            document.body.appendChild(form);
            form.submit();
        }

}


var COOKIE_LIFE_COMPLETE_REBATE_LOGIN = 720;
/**
 * Handles the initialization logic when the "Screen Back" button is clicked.
 *
 * This function retrieves the currently triggered UI element from the global
 * event object and hides it by setting its `visible` property to `false`.
 * It is typically used to control backward navigation behavior in a
 * multi-step interface or wizard-style flow.
 *
 * @param {Object} screenBackButton - The button element that triggered the action.
 * @param {scope} globals
 */
function handleScreenBackInitialization(screenBackButton, globals) {
    const currentField = globals.event.target;
    globals.functions.setProperty(currentField, { visible: false });
}

/** Returns true if the value is not null, undefined, empty, or whitespace-only.
 * @param {*} value - Value to validate. */
function hasValue(value) {
    return value !== null &&
        value !== undefined &&
        String(value).trim().length > 0;
}

/**
 * Handles the Cancel action from the Edit panel within the enrollment review workflow.
 *
 * When triggered, this function:
 * - Removes validation/input patterns associated with the edit form.
 * - Opens a confirmation modal prompting the user to confirm cancellation.
 * - If confirmed (OK button):
 *    - Hides the editable panel and restores the review panel view.
 *    - Resets all editable fields to their original values from the Account panel.
 *    - Restores checkbox, radio button, and hidden field values.
 *    - Re-formats and synchronizes the mobile phone number where applicable.
 *    - Updates SMS-related fields based on the mobile phone checkbox state.
 * - If cancelled (Cancel button):
 *    - Simply closes the confirmation modal without making changes.
 *
 * This ensures that any unsaved edits are discarded and the UI state
 * is reverted back to the last saved account data.
 *
 * @param {scope} globals
 */
function handleEditCancelPanelClick(globals) {
    removeInputPatternByClass('adob');
    const currentField = globals.event.target;
    const editCancelPanel = currentField.$parent;
    const mainReviewPanel = currentField.$parent.$parent;
    const enrollmentFormWizardPanel = currentField.$parent.$parent.$parent;

    modalOpen();
    $(".abbv-qPoll #okBtn").click(function () {

        globals.functions.setProperty(currentField, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel, { visible: false });
        globals.functions.setProperty(mainReviewPanel.reviewPanel, { visible: true });
        globals.functions.setProperty(editCancelPanel.editButton, { visible: true });
        modalClose();

        var indicationCookieValue = baseGetCookieValue('indicationName');
        globals.functions.setProperty(mainReviewPanel.editablePanel.editFirstName, { value: enrollmentFormWizardPanel.accountPanel.AccfirstName.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editLastName, { value: enrollmentFormWizardPanel.accountPanel.AccountlastName.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editDOB, { value: enrollmentFormWizardPanel.accountPanel.dob.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editSex, { value: enrollmentFormWizardPanel.accountPanel.sex.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editGender, { value: enrollmentFormWizardPanel.accountPanel.genderIdentity.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editPhoneNumber, { value: enrollmentFormWizardPanel.accountPanel.phoneNumber.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editAddressPanel.editStreetAddress, { value: enrollmentFormWizardPanel.accountPanel.streetAddressTextbox.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editAddressPanel.editStreetAddress2, { value: enrollmentFormWizardPanel.accountPanel.streetAddress2Textbox.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editAddressPanel.editCity, { value: enrollmentFormWizardPanel.accountPanel.cityTextbox.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editAddressPanel.editState, { value: enrollmentFormWizardPanel.accountPanel.stateDropdown.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editAddressPanel.editZipcode, { value: enrollmentFormWizardPanel.accountPanel.addressZipCode.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editNextTreatmentDate, { value: enrollmentFormWizardPanel.treatmentPanel.upcomingTreatmentDate.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editgastroUpcomingTreatment, { value: enrollmentFormWizardPanel.treatmentPanel.gastroUpcomingTreatment.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editinfusionType, { value: enrollmentFormWizardPanel.treatmentPanel.infusionType.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editpsaInfusionType, { value: enrollmentFormWizardPanel.treatmentPanel.psaInfusionType.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editsavingCardPanel.editrxBIN, { value: enrollmentFormWizardPanel.insurancePanel.savingCardPanel.rxBIN.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editsavingCardPanel.editrxGroup, { value: enrollmentFormWizardPanel.insurancePanel.savingCardPanel.rxGroup.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editsavingCardPanel.editrxPCN, { value: enrollmentFormWizardPanel.insurancePanel.savingCardPanel.rxPCN.$value });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editPhoneNumberCheckbox, { value: enrollmentFormWizardPanel.accountPanel.mobilePhoneCheckbox.$value });
        globals.functions.setProperty(enrollmentFormWizardPanel.accountPanel.hiddenPhoneNumberValue, { value: mainReviewPanel.editablePanel.editPhoneNumber.$value.replaceAll("-", "") });
        globals.functions.setProperty(enrollmentFormWizardPanel.accountPanel.hiddenOrigMobileCheckbox, { value: enrollmentFormWizardPanel.accountPanel.mobilePhoneCheckbox.$value });

        if(indicationCookieValue === "pediatric-plaque-psoriasis" || indicationCookieValue === "juvenile-psoriatic-arthritis") {
            globals.functions.setProperty(mainReviewPanel.editablePanel.editChildRecentTreatment, { value: enrollmentFormWizardPanel.treatmentPanel.childUpcomingTreatmentDate.$value });
            globals.functions.setProperty(mainReviewPanel.editablePanel.editChildFirstName, { value: enrollmentFormWizardPanel.accountPanel.childFirstName.$value });
            globals.functions.setProperty(mainReviewPanel.editablePanel.editChildLastName, { value: enrollmentFormWizardPanel.accountPanel.childlastName.$value });
            globals.functions.setProperty(mainReviewPanel.editablePanel.editChildDOB, { value: enrollmentFormWizardPanel.accountPanel.childdob.$value });
            globals.functions.setProperty(mainReviewPanel.editablePanel.editChildSex, { value: enrollmentFormWizardPanel.accountPanel.childSex.$value });

            var indication =  indicationCookieValue === "pediatric-plaque-psoriasis" ? '6a' : '3a';
            globals.functions.setProperty(mainReviewPanel.editablePanel.indicationOptionsRadioButton, { value: indication });
        } else {
            globals.functions.setProperty(mainReviewPanel.editablePanel.indicationOptionsRadioButton, { value: mainReviewPanel.editablePanel.hiddenIndicationId.$value });
        }

        if (enrollmentFormWizardPanel.accountPanel.mobilePhoneCheckbox.$value === 'true') {
            globals.functions.setProperty(mainReviewPanel.skyriziCompleteTextMessagesPanel.textmessagepanel.mobilePhoneNumber, { value: enrollmentFormWizardPanel.accountPanel.phoneNumber.$value.replace(/\D/, '').replace(/(\d{3})\-?(\d{3})\-?(\d{4})/, '$1-$2-$3') });
            // globals.functions.setProperty(textMessageCheckbox.$value, { value: 'true' });
        } else {
            globals.functions.reset(mainReviewPanel.skyriziCompleteTextMessagesPanel.textmessagepanel.mobilePhoneNumber);
            globals.functions.setProperty(mainReviewPanel.skyriziCompleteTextMessagesPanel.textmessagepanel.hiddenSmsMobilePhoneValue, { value: mainReviewPanel.skyriziCompleteTextMessagesPanel.textmessagepanel.mobilePhoneNumber.$value });
            // globals.functions.setProperty(textMessageCheckbox, { value: 'false' });
        }
    });

    $(".abbv-qPoll #cancelBtn").click(function () {
        modalClose();
    });
}

/**
 * Handles backward navigation within the Enrollment Form Wizard.
 *
 * This function manages UI state and navigation when a user clicks
 * a "Back" button inside the wizard flow.
 *
 * Behavior:
 * - Identifies the current wizard panel using the global event context.
 * - Adjusts button visibility (hides submit, shows continue).
 * - If the active panel is the "treatmentPanel", restores the main back button
 *   and hides the current back button.
 * - Moves focus to the previous item in the wizard without enforcing validation.
 * - If no active child panel exists, hides the current back button.
 *
 * Note:
 * Validation is intentionally skipped during backward navigation
 * to allow users to move freely to previous steps.
 *
 * @param {Object} button - The back button component that triggered the action.
 * @param {scope} globals
 */
function handleScreenBackNavigation(button, globals) {

    const currentField = globals.event.target;
    if (currentField && currentField.$parent && currentField.$parent.$parent.$parent.$parent) {
        const wizard = currentField.$parent.$parent.$parent.$parent.enrollmentFormWizardPanel;

        const panelName = wizard.$activeChild.$name;

        admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);

        if (wizard.$activeChild) {
            // can skip the validations for screenback
            globals.functions.setFocus(wizard, 'previousItem');
        } else {
            globals.functions.setProperty(button, { visible: false });
        }
    }
}

/**
 * Initializes the Enrollment Form Wizard and sets focus to the current item.
 *
 * @param {scope} globals
 */
function onFormInitializeSetWizardItem(globals) {
    const wizard = globals.event.target;
    if (!wizard) {
        return;
    }
    globals.functions.setFocus(wizard, 'nextItem');
}

/**
 * Handles forward navigation within the Enrollment Form Wizard.
 *
 * This function controls the behavior when the user clicks the
 * "Continue" button in a multi-step wizard flow.
 *
 * Behavior:
 * - Identifies the active wizard panel using the global event context.
 * - Performs validation on the current panel before allowing navigation.
 * - If validation passes:
 *     - Moves focus to the next item in the wizard.
 * - If validation fails:
 *     - Prevents navigation and logs a warning.
 * - If the active panel is "insurancePanel":
 *     - Hides the Continue button.
 *     - Displays the Submit button.
 * - Updates back button visibility:
 *     - Hides the main back button.
 *     - Shows the screen-level back button.
 * - If no active child panel exists, attempts to move to the next panel.
 *
 * @param {Object} continueButton - The continueButton element (this)
 * @param {scope} globals
 */
function handleContinueNavigation(continueButton, globals) {

    const currentField = globals.event.target;
    if (currentField && currentField.$parent && currentField.$parent.$parent.$parent.$parent) {
        const wizard = currentField.$parent.$parent.$parent.$parent.enrollmentFormWizardPanel;

        admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);

        if (wizard.$activeChild) {
            const panelName = wizard.$activeChild.$name;

            const validations = globals.functions.validate(wizard.$activeChild);
            if (validations.length === 0) {
                globals.functions.setFocus(wizard, 'nextItem');
                if (panelName == 'insurancePanel') {
                    globals.functions.setProperty(wizard.reviewPanel.skyriziCompleteTextMessagesPanel.textmessagepanel.mobilePhoneNumber, { visible: true });
                } else {
                    globals.functions.setProperty(wizard.reviewPanel.skyriziCompleteTextMessagesPanel.textmessagepanel.mobilePhoneNumber, { visible: false });
                }
            } else {
                let elementById = getElementById(validations[0].fieldName);
                if (elementById.$id) {
                    globals.functions.setFocus(elementById);
                } else {
                    elementById.$id = elementById.id;
                    globals.functions.setFocus(elementById);
                }
            }
        } else {
            globals.functions.setFocus(null, 'nextItem');
        }
    }
}

/**
 * Handles final form submission.
 *
 * Resets specific campaign fields based on indication selection,
 * validates the form, and submits the data as JSON if validation passes
 * (allowing only a possible reCAPTCHA error). Disables the submit
 * button to prevent duplicate submissions.
 *
 * @param {scope} globals
 */
function handleSubmitClick(globals) {
    const currentField = globals.event.target;
    const editablePanel = currentField.$parent.$parent.editablePanel;

    // Reset QuestionAnswer3 if indication is "6" or "3"
    if (editablePanel.indicationOptionsRadioButton.$value === "6" || editablePanel.indicationOptionsRadioButton.$value === "3") {
        globals.functions.reset(editablePanel.campaignQuestionsPanel.QuestionAnswer3);
    }

    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();

    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);

    if (errors.length === 0 || (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $(".custom-submit").prop("disabled", true);
        showLoader(true,"Submitting");
        fetchObservabilityAndSubmit(globals, formData);
    } else {
        var firstErrorField = errors[0];
        if (firstErrorField) {
            globals.functions.setFocus(firstErrorField);
        }
        console.warn("Please fill the empty fields");
    }
}


/**
 * Updates the visibility of the submit button based on
 * the current panel in the navigation context.
 *
 * @param {scope} globals - The submit button element (this)
 */
function handleSubmitInitialization(globals) {
     const currentField = globals.event.target;
    globals.functions.setProperty(currentField, { visible: false });
}

/**
 * Updates the mandatory state of the mobile phone number and opt-in checkbox
 * based on the mobile opt-in checkbox value or entered mobile phone number.
 *
 * @param {scope} globals - The value of the mobile opt-in checkbox and mobile phone number
 */
function handleMobileOptinCheckbox(globals) {
    const currentField = globals.event.target;

    const textmessagepanel = currentField.$parent;
    if (currentField.$value) {
        globals.functions.setProperty(textmessagepanel.mobilePhoneNumber, { required: true });
    } else {
        globals.functions.setProperty(textmessagepanel.mobilePhoneNumber, { required: false });
    }
}

/**
 * Updates the mandatory state of the  opt-in checkbox
 * based on entered mobile phone number.
 *
 * @param {scope} globals - The value of the mobile phone number
 */
function handleSMSOptinCheckboxOnMobileNoAddition(globals) {
    const currentField = globals.event.target;

    const textmessagepanel = currentField.$parent;
    if (currentField.$value) {
        textmessagepanel.mobOptinCheckBox && globals.functions.setProperty(textmessagepanel.mobOptinCheckBox, { required: true });
    } else {
        textmessagepanel.mobOptinCheckBox && globals.functions.setProperty(textmessagepanel.mobOptinCheckBox, { required: false });
    }
}



/**
 * Handles mobile phone number value commit rules.
 *
 * Updates hidden value, formats phone number based on checkboxes,
 * and sets the opt-in checkbox depending on input presence.
 *
 * @param {scope} globals
 */
function handleMobilePhoneNumber(globals) {

    const currentField = globals.event.target;
    const textmessagepanel = currentField.$parent;
    const skyriziCompleteTextMessagesPanel = currentField.$parent.$parent;
    const mainReviewPanel = currentField.$parent.$parent.$parent;
    const enrollmentFormWizardPanel = currentField.$parent.$parent.$parent.$parent;

    // Update hidden SMS mobile phone value (remove dashes)
    textmessagepanel.hiddenSmsMobilePhoneValue.$value = removeHypenFromValue(currentField.$value);

    // Format mobile phone number based on checkboxes
    if (enrollmentFormWizardPanel.accountPanel.mobilePhoneCheckbox.$value === 'true' && textmessagepanel.mobilePhoneNumber.$value === enrollmentFormWizardPanel.accountPanel.phoneNumber.$value) {

        globals.functions.setProperty(textmessagepanel.mobilePhoneNumber, {
            value: enrollmentFormWizardPanel.accountPanel.phoneNumber.$value.replace(/\D/g, '')
                .replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
        });

    } else if (mainReviewPanel.editablePanel.editPhoneNumberCheckbox.$value === 'true' && textmessagepanel.mobilePhoneNumber.$value === enrollmentFormWizardPanel.accountPanel.phoneNumber.$value) {
        globals.functions.setProperty(textmessagepanel.mobilePhoneNumber, {
            value: mainReviewPanel.editablePanel.editPhoneNumber.$value.replace(/\D/g, '')
                .replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
        });
    }

    // Update opt-in checkbox based on presence of input
    if (currentField.$value) {
        globals.functions.setProperty(textmessagepanel.mobOptinCheckBox, { mandatory: true });
        // globals.functions.setProperty(skyriziCompleteTextMessagesPanel.textMessageCheckbox, { value: 'true' });
    } else {
        globals.functions.setProperty(textmessagepanel.mobOptinCheckBox, { mandatory: false });
        // globals.functions.setProperty(skyriziCompleteTextMessagesPanel.textMessageCheckbox, { value: 'false' });
    }
}

/**
 * Updates visibility of infusion and treatment fields
 * based on the given indication value.
 *
 * @param {scope} globals
 */
function handleIndicationFields(globals) {
    const currentField = globals.event.target;
    const editablePanel = currentField.$parent;
    const indicationValue = currentField.$value;
    if(indicationValue != "3a" && indicationValue != "6a") {
         updateEditablePediatricFieldsVisibility(globals, editablePanel, false);
    } else {
         updateEditablePediatricFieldsVisibility(globals, editablePanel, true);
         globals.functions.setProperty(editablePanel.editgastroUpcomingTreatment, { visible: false });
         globals.functions.setProperty(editablePanel.editpsaInfusionType, { visible: false });
         globals.functions.setProperty(editablePanel.editinfusionType, { visible: false });
    }
    if (indicationValue === "2" || indicationValue === "4") {
        globals.functions.setProperty(editablePanel.editpsaInfusionType, { visible: false });
        globals.functions.setProperty(editablePanel.editgastroUpcomingTreatment, { visible: true });

        if (editablePanel.editgastroUpcomingTreatment.$value === '2355DE7C-4858-4B3A-B74E-3F022F7E9A35') {
            globals.functions.setProperty(editablePanel.editinfusionType, { visible: true });
        } else {
            globals.functions.setProperty(editablePanel.editinfusionType, { visible: false });
        }

    } else if (indicationValue === "3" || indicationValue === "6") {
        globals.functions.setProperty(editablePanel.editgastroUpcomingTreatment, { visible: false });
        globals.functions.setProperty(editablePanel.editpsaInfusionType, { visible: true });
        globals.functions.setProperty(editablePanel.editinfusionType, { visible: false });
    }
}
/**
 * Updates visibility of pediatric  fields
 * based on the given indication value.
 *
 * @param {scope} globals
 * @param {object} editablePanel - The editable panel containing pediatric fields
 * @param {boolean} isVisible - Flag indicating whether to show or hide pediatric fields
 */

 function updateEditablePediatricFieldsVisibility(globals, editablePanel, visibility) {
    editablePanel.editChildRecentTreatment && globals.functions.setProperty(editablePanel.editChildRecentTreatment, { visible: visibility });
    editablePanel.editChildFirstName && globals.functions.setProperty(editablePanel.editChildFirstName, { visible: visibility });
    editablePanel.editChildLastName && globals.functions.setProperty(editablePanel.editChildLastName, { visible: visibility });
    editablePanel.editChildDOB && globals.functions.setProperty(editablePanel.editChildDOB, { visible: visibility });
    editablePanel.editChildSex && globals.functions.setProperty(editablePanel.editChildSex, { visible: visibility });
 }

/**
 * Returns the provided source value. If the source is an object with a `$value` property,
 * its `$value` is returned; otherwise the source itself is returned.
 *
 * @param {object} source
 * @param {scope} globals
 */
function setValueFromSource(source, globals) {
    if (typeof source != "string") {
        return source.$value;
    }
    return source;
}


/**
 * Handles the rules for the Edit Phone Number Checkbox.
 *
 * @param {string} value - The value of the Phone Number
 */
function formatPhoneNumber(value) {
    if (!value) return '';

    const digits = value.replace(/\D/g, ''); // remove non-digits

    if (digits.length !== 10) {
        return digits; // return cleaned digits if not 10 numbers
    }

    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}


/**
 * Updates the hidden phone number field by removing all dashes.
 *
 * @param {string} inputValue - The phone number input value
 */
function updateHiddenPhoneNumber(inputValue) {
    hiddenPhoneNumberValue.value = removeHypenFromValue(inputValue);
}

/**
 * Removes the pattern attribute from input fields
 * inside the specified class.
 *
 * @param {String} className - Class name containing input elements (without dot)
 */
function removeInputPatternByClass(className) {
    $('.' + className + ' input').removeAttr('pattern');
}


/**
 * Updates HTML content of elements matching the given class name.
 *
 * @param {String} className - Class name of the target element (without dot)
 * @param {object} value - Value to be set as HTML
 */
function updateHtmlByClass(className, value) {
    if (typeof value != "string") {
        $('.' + className).html(value.$value);
    } else {
        $('.' + className).html(value);
    }
}

/**
 * Updates HTML content of elements matching the given class name.
 *
 * @param {String} className - Class name of the target element (without dot)
 * @param {object} value - Display Text of Radio Button to be set as HTML
 */
function updateHtmlByDisplayText(className, value) {
    if (typeof value != "string") {
        $('.' + className).html(value.$enumNames[value.$enum.indexOf(value.$value)]);
    } else {
        $('.' + className).html(value.$enumNames[value.$enum.indexOf(value)]);
    }
}

/**
 * Populates dynamic Saving Card field instances with Rx details.
 *
 * Iterates through the savings card data and assigns Rx Identifier,
 * Group, BIN, PCN, and Suffix values to each corresponding dynamic
 * field instance using global utility functions.
 *
 */
function updateSavingCardObject(savingCardFields, globals) {

    var savingsCard = baseGetCookieValue('admp_crsaveCard');
    if (savingsCard) {
        var crscDetails = JSON.parse(savingsCard);

        // savingCardFields.jsonModel.maxOccur = savingsCardMaxOccur;
        for (var i = 0; i < crscDetails.length; i++) {
            var instance = savingCardFields[i];

            // var instance = savingCardFields.instanceManager.instances[i];
            globals.functions.setProperty(instance.dynamicRXId, { value: crscDetails[i].RxIdentifier });
            globals.functions.setProperty(instance.dynamicRxGroup, { value: crscDetails[i].RxGroup });
            globals.functions.setProperty(instance.dynamicRxBIN, { value: crscDetails[i].RxBIN });
            globals.functions.setProperty(instance.dynamicRxPCN, { value: crscDetails[i].RxPCN });
            globals.functions.setProperty(instance.dynamicSuf, { value: crscDetails[i].Suf });

            instance = null;
        }
    }
}
/**
 * Iterates through the savings card data and assigns Rx Identifier,
 * Group, BIN, PCN, and Suffix values to each corresponding dynamic
 * field instance using global utility functions.
 *
 * @param {object} savingCardFields
 */
function removeInstanceOf(savingCardFields) {
    const instanceCount = savingCardFields.length;
    for (var j = 0; j < instanceCount; j++) {
        const instance = savingCardFields[j];
        const value = instance.dynamicRXId.$value;

        // Check null, or empty value
        if (value === null || value === "") {
            console.log("Rx Identifier Value is null/empty. Instance is removed.");
            return true;
        }
    }

    return false;
}


/**
 * Initializes enrollment form logic on load.
 *
 * - Validates required cookies and redirects if missing (non-author environment).
 * - Configures UI visibility and indication values based on indication cookie.
 * - Updates review panel fields and indication display text.
 * - Prefills account details into the review panel.
 * - Populates dynamic savings card data.
 * - Clears temporary dropdown, checkbox, and radio cookies.
 *
 *@param {scope} globals
 */
function initializeFormLogic(globals) {
    const currentField = globals.event.target;
    const enrollmentFormWizardPanel = currentField.enrollmentFormWizardPanel;
    const mainReviewPanel = enrollmentFormWizardPanel.reviewPanel;
    const accountPanel = enrollmentFormWizardPanel.accountPanel;
    const savingCardFields = enrollmentFormWizardPanel.insurancePanel.dynamicSavingsCard.savingCardFields;

    var admp_cremail = baseGetCookieValue('admp_cremail');
    var indicationCookieValue = baseGetCookieValue('indicationName');
    if (!admp_cremail || !indicationCookieValue) {
        if (!isEnvironmentAuthor()) {
            window.parent.location.href = accountPanel.redirectionUrl.$value;
        }
    }

    if (indicationCookieValue !== null && indicationCookieValue === "psoriasis") {
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.psaInfusionType, { visible: true });
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.gastroUpcomingTreatment, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editgastroUpcomingTreatment, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editpsaInfusionType, { visible: true });
        globals.functions.setProperty(mainReviewPanel.editablePanel.hiddenIndicationId, { value: '6' });
        globals.functions.setProperty(mainReviewPanel.editablePanel.indicationOptionsRadioButton, { value: '6' });
        document.addEventListener("AF_FormContainerInitialised", function () {
            updateHtmlByClassSafe('indicationSelected', 'Moderate to Severe Plaque Psoriasis');
        });

    } else if (indicationCookieValue !== null && indicationCookieValue === "psoriatic-arthritis") {
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.psaInfusionType, { visible: true });
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.gastroUpcomingTreatment, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editgastroUpcomingTreatment, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editpsaInfusionType, { visible: true });
        globals.functions.setProperty(mainReviewPanel.editablePanel.hiddenIndicationId, { value: '3' });
        globals.functions.setProperty(mainReviewPanel.editablePanel.indicationOptionsRadioButton, { value: '3' });
        document.addEventListener("AF_FormContainerInitialised", function () {
            updateHtmlByClassSafe('indicationSelected', 'Active Psoriatic Arthritis');
        });

    } else if (indicationCookieValue !== null && indicationCookieValue === "crohns") {
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.psaInfusionType, { visible: false });
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.gastroUpcomingTreatment, { visible: true });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editgastroUpcomingTreatment, { visible: true });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editpsaInfusionType, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel.hiddenIndicationId, { value: '2' });
        globals.functions.setProperty(mainReviewPanel.editablePanel.indicationOptionsRadioButton, { value: '2' });
        document.addEventListener("AF_FormContainerInitialised", function () {
            updateHtmlByClassSafe('indicationSelected', "Moderate to Severe Crohn's Disease");
        });

    } else if (indicationCookieValue !== null && indicationCookieValue === "psoriasis-psoriatic-arthritis") {
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.psaInfusionType, { visible: true });
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.gastroUpcomingTreatment, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editgastroUpcomingTreatment, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editpsaInfusionType, { visible: true });
        globals.functions.setProperty(mainReviewPanel.editablePanel.hiddenIndicationId, { value: '6' });
        globals.functions.setProperty(mainReviewPanel.editablePanel.indicationOptionsRadioButton, { value: '6' });

    } else if (indicationCookieValue !== null && indicationCookieValue === "ulcerative-colitis") {
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.psaInfusionType, { visible: false });
        globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.gastroUpcomingTreatment, { visible: true });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editgastroUpcomingTreatment, { visible: true });
        globals.functions.setProperty(mainReviewPanel.editablePanel.editpsaInfusionType, { visible: false });
        globals.functions.setProperty(mainReviewPanel.editablePanel.hiddenIndicationId, { value: '4' });
        globals.functions.setProperty(mainReviewPanel.editablePanel.indicationOptionsRadioButton, { value: '4' });
        document.addEventListener("AF_FormContainerInitialised", function () {
            updateHtmlByClassSafe('indicationSelected', 'Moderate to Severe Ulcerative Colitis Disease');
        });
    }else if (indicationCookieValue !== null && (indicationCookieValue === "pediatric-plaque-psoriasis" || indicationCookieValue === "juvenile-psoriatic-arthritis")) {
         globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.upcomingTreatmentDate, { visible: false });
         globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.gastroUpcomingTreatment, { visible: false });
         globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.psaInfusionType, { visible: false });
         globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.childUpcomingTreatmentDate, { visible: true });
         globals.functions.setProperty(enrollmentFormWizardPanel.treatmentPanel.childUpcomingTreatment, { visible: true });

         globals.functions.setProperty(mainReviewPanel.editablePanel.editNextTreatmentDate, { visible: false });
         globals.functions.setProperty(mainReviewPanel.editablePanel.editgastroUpcomingTreatment, { visible: false });
         globals.functions.setProperty(mainReviewPanel.editablePanel.editpsaInfusionType, { visible: false });
         globals.functions.setProperty(mainReviewPanel.editablePanel.editChildRecentTreatment, { visible: true });

         let indicationId = indicationCookieValue === "pediatric-plaque-psoriasis" ? '6' : '3';
         let indication =  indicationCookieValue === "pediatric-plaque-psoriasis" ? '6a' : '3a';
         let selectedIndicationText = indicationCookieValue === "pediatric-plaque-psoriasis" ? 'Moderate to Severe Pediatric Plaque Psoriasis' : 'Juvenile Psoriatic Arthritis';
         globals.functions.setProperty(mainReviewPanel.editablePanel.hiddenIndicationId, { value: indicationId });
         globals.functions.setProperty(mainReviewPanel.editablePanel.indicationOptionsRadioButton, { value: indication });
         document.addEventListener("AF_FormContainerInitialised", function () {
             updateHtmlByClassSafe('indicationSelected', selectedIndicationText);
         });
         }

    prefillDetails(accountPanel, mainReviewPanel.editablePanel, globals);
    updateSavingCardObject(savingCardFields, globals);

    // Enabled guideRootPanel - Initialize
    /* Added as part of AIP-11006 */
    deleteCookie('dropdown');
    deleteCookie('checkbox');
    deleteCookie('radio');
}
/**
 * @function isEnvironmentAuthor
 * @description Checks if the current environment's run modes include 'author'.
 * @returns {boolean} Returns true if the 'author' run mode is present, otherwise returns false.
 *
 * @example
 * // Assume window.parent.AbbViePageInfo.runModes = 'author,publish'
 *
 * if (isEnvironmentAuthor()) {
 *     console.log('The current environment is an author environment.');
 * } else {
 *     console.log('The current environment is not an author environment.');
 * }
 */
function isEnvironmentAuthor() {
    var runModes = window.parent.AbbViePageInfo.runModes.split(',');
    var trimmedModes = runModes.map(function (a) {
        return a.trim();
    });

    if (trimmedModes.indexOf('author') !== -1) {
        return true;
    }
}


/**
 * @param {String} value
 */
function removeHypenFromValue(value) {
    if (value === null) {
        return value;
    }
    return value.replaceAll("-", "");
}

/**
 * Updates elements by class name if the value is not null or undefined.
 * Skips the update when the value is null or undefined.
 */
function updateHtmlByClassSafe(className, value) {
    if (value != null) {
        updateHtmlByClass(className, value);
    }
}

/**
 * Prefills account and editable panel fields using stored cookies.
 *
 * - Retrieves email, request details, and personal details from cookies.
 * - Decrypts and parses cookie data if present.
 * - Updates account panel and review panel fields (name, email, gender, DOB, address, phone).
 * - Updates displayed email in the UI.
 *
 */
function prefillDetails(accountPanel, editablePanel, globals) {
    var emailId = baseGetCookieValue('admp_cremail');
    if (emailId) {
        globals.functions.setProperty(editablePanel.editEmailAddress, { value: emailId });
        document.addEventListener("AF_FormContainerInitialised", function () {
            updateHtmlByClassSafe('emailaddress', emailId);
        });
    }
    if (baseGetCookieValue('admp_crrequestDetails')) {
        var decryptCRDetails = window.sjcl.decrypt('', baseGetCookieValue('admp_crrequestDetails'));
        if (decryptCRDetails) {
            var requestDetails = JSON.parse(decryptCRDetails);
            if (requestDetails) {
                if (hasValue(requestDetails.FirstName)) {
                    globals.functions.setProperty(accountPanel.AccfirstName, {
                        value: requestDetails.FirstName
                    });
                }

                if (hasValue(requestDetails.LastName)) {
                    globals.functions.setProperty(accountPanel.AccountlastName, {
                        value: requestDetails.LastName
                    });
                }

                if (hasValue(requestDetails.Gender)) {
                    globals.functions.setProperty(accountPanel.sex, {
                        value: requestDetails.Gender
                    });
                }

                if (hasValue(requestDetails.GenderIdentity)) {
                    globals.functions.setProperty(accountPanel.genderIdentity, {
                        value: requestDetails.GenderIdentity
                    });
                }

                if (hasValue(requestDetails.DateOfBirth)) {
                    globals.functions.setProperty(accountPanel.dob, {
                        value: requestDetails.DateOfBirth
                    });
                }

                if (hasValue(requestDetails.ZipCode)) {
                    globals.functions.setProperty(accountPanel.addressZipCode, {
                        value: requestDetails.ZipCode
                    });
                }

                // for review panel
                document.addEventListener("AF_FormContainerInitialised", function () {
                    updateHtmlByClassSafe('fname', requestDetails.FirstName);
                    updateHtmlByClassSafe('lname', requestDetails.LastName);
                    updateHtmlByClassSafe('reviewsex', requestDetails.Gender);
                    updateHtmlByClassSafe('gender-identity', requestDetails.GenderIdentity);
                    updateHtmlByClassSafe('reviewdob', requestDetails.DateOfBirth);
                    updateHtmlByClassSafe('reviewzipcode', requestDetails.ZipCode);
                });

            }
        }
    }
    if (baseGetCookieValue('admp_crprefill')) {
        var personalDetails = window.sjcl.decrypt('', baseGetCookieValue('admp_crprefill'));
        if (personalDetails) {
            var crPerDetails = JSON.parse(personalDetails);
            if (crPerDetails) {

                if (hasValue(crPerDetails.EmailAddress)) {
                   globals.functions.setProperty(editablePanel.editEmailAddress, { value: crPerDetails.EmailAddress });
                }

                if (hasValue(crPerDetails.FirstName)) {
                    globals.functions.setProperty(accountPanel.AccfirstName, {
                        value: crPerDetails.FirstName
                    });
                }

                if (hasValue(crPerDetails.LastName)) {
                    globals.functions.setProperty(accountPanel.AccountlastName, {
                        value: crPerDetails.LastName
                    });
                }

                if (hasValue(crPerDetails.Gender)) {
                    globals.functions.setProperty(accountPanel.sex, {
                        value: crPerDetails.Gender
                    });
                }

                if (hasValue(crPerDetails.GenderIdentity)) {
                    globals.functions.setProperty(accountPanel.genderIdentity, {
                        value: crPerDetails.GenderIdentity
                    });
                }

                if (hasValue(crPerDetails.DateOfBirth)) {
                    globals.functions.setProperty(accountPanel.dob, {
                        value: crPerDetails.DateOfBirth
                    });
                }

                if (hasValue(crPerDetails.AddressLine1)) {
                    globals.functions.setProperty(accountPanel.streetAddressTextbox, {
                        value: crPerDetails.AddressLine1
                    });
                }
                if (hasValue(crPerDetails.AddressLine2)) {
                    globals.functions.setProperty(accountPanel.streetAddress2Textbox, {
                        value: crPerDetails.AddressLine2
                    });
                }
                if (hasValue(crPerDetails.City)) {
                    globals.functions.setProperty(accountPanel.cityTextbox, {
                        value: crPerDetails.City
                    });
                }
                if (hasValue(crPerDetails.State)) {
                    globals.functions.setProperty(accountPanel.stateDropdown, {
                        value: crPerDetails.State
                    });
                }
                if (hasValue(crPerDetails.ZipCode)) {
                    globals.functions.setProperty(accountPanel.addressZipCode, {
                        value: crPerDetails.ZipCode
                    });
                }

                if (hasValue(crPerDetails.PhoneNumber)) {
                    globals.functions.setProperty(accountPanel.phoneNumber, {
                        value: crPerDetails.PhoneNumber
                    });
                }

                // for review panel
                document.addEventListener("AF_FormContainerInitialised", function () {
                    updateHtmlByClassSafe('emailaddress', crPerDetails.EmailAddress);
                    updateHtmlByClassSafe('fname', crPerDetails.FirstName);
                    updateHtmlByClassSafe('lname', crPerDetails.LastName);
                    updateHtmlByClassSafe('reviewsex', crPerDetails.Gender);
                    updateHtmlByClassSafe('gender-identity', crPerDetails.GenderIdentity);
                    updateHtmlByClassSafe('reviewdob', crPerDetails.DateOfBirth);
                    updateHtmlByClassSafe('streetaddress', crPerDetails.AddressLine1);
                    updateHtmlByClassSafe('streetaddress2', crPerDetails.AddressLine2);
                    updateHtmlByClassSafe('reviewcity', crPerDetails.City);
                    updateHtmlByClassSafe('reviewstate', crPerDetails.State);
                    updateHtmlByClassSafe('reviewzipcode', crPerDetails.ZipCode);
                    updateHtmlByClassSafe('primaryphone', crPerDetails.PhoneNumber);
                });
            }
        }
    }
}

/**
 * Initializes the profile panel by checking for a saved profile cookie.
 * If the cookie exists, decrypts it and populates the profile fields.
 * If not, redirects the user to the rebate home page.
 * @param {scope} globals
 * @param {string} navUrl
 */
function initializeProfilePanel(navUrl,globals) {
    // Get the profile cookie
    var profileCookie = baseGetCookieValue('admp_cr_ng_profile');

    if (profileCookie) {
        // Decrypt the cookie value
        var decryptCRDetails = getDecryptedvalue('admp_cr_ng_profile');

        if (decryptCRDetails) {
            // Populate the profile panel fields
            basePopulateCompleteRebateProfile(decryptCRDetails, globals);
        }
    } else {
        // Redirect to rebate home if no profile data exists
        window.location.assign(navUrl);
    }
}

/**
 * Initializes the profile panel by checking for a saved profile cookie.
 * If the cookie exists, decrypts it and populates the profile fields.
 * If not, redirects the user to the rebate home page.
 * @param {scope} globals
 * @param {string} navUrl
 */
function initializeProfilePanelV1(navUrl,globals) {
    // Get the profile cookie
    var profileCookie = baseGetCookieValue('admp_cr_ng_profile');

    if (profileCookie) {
        // Decrypt the cookie value
        var decryptCRDetails = getDecryptedvalue('admp_cr_ng_profile');

        if (decryptCRDetails) {
            // Populate the profile panel fields
            basePopulateCompleteRebateProfileV1(decryptCRDetails, globals);
        }
    } else {
        // Redirect to rebate home if no profile data exists
        window.location.assign(navUrl);
    }
}
/**
 * Retrieves and decrypts JSON data stored in a cookie.
 *
 * - Fetches the cookie value using the provided key.
 * - Decrypts the cookie using `sjcl.decrypt`.
 * - Parses the decrypted string as JSON and returns it.
 * - Returns `undefined` if the cookie does not exist or decryption fails.
 */
function getDecryptedvalue(key) {
    var requestDetails;
    if (baseGetCookieValue(key)) {
        var decryptCRDetails = window.sjcl.decrypt('', baseGetCookieValue(key));
        if (decryptCRDetails) {
            requestDetails = JSON.parse(decryptCRDetails);
        }
    }
    return requestDetails;
}

/**
 * Attach a click handler to the Save button on the Update Profile template.
 *
 * When the save button is clicked, it triggers the
 * `handleUpdateProfileSubmitAction` function.
 *
 * @param {scope} globals
 */
function handleUpdateProfileSaveClick(globals) {
    var formData = globals.functions.exportData();
    var errors = globals.functions.validate();
    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);

    if (errors.length === 0 || (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'))) {
        $(".custom-submit").prop("disabled", true);
        showLoader(true,"Submitting");
        fetchObservabilityAndSubmit(globals, formData);
    } else {
        var firstErrorField = errors[0];
        if (firstErrorField) {
            globals.functions.setFocus(firstErrorField);
        }
        console.warn("Please fill the empty fields");
    }
}

/**
 * Attach a click handler to the Save button on the Update Profile template.
 *
 * When the save button is clicked, it triggers the
 * `handleUpdateProfileSubmitAction` function.
 *
 * @param {scope} globals
 */
function commonAPISubmissionError(globals) {
    $('.custom-submit').prop('disabled', false);
    showLoader(false);
    let errorResponse = globals.event.payload.body;
    let payload = JSON.parse(globals.event.payload.body);
    let errorList = extractErrorCodes(payload);
    baseSubmitReset();
    if (errorList && errorList.length) {
        handleFieldError(errorList, globals);
    } else {
        handleErrorDetail(globals);
    }
    admp_analytics_functions.onFormSubmitError(errorList);
}

function handleErrorDetail(globals) {
    const genericErrorFragment = globals.form.$items.find(item =>
        item.$fieldType === 'panel' && item.$name.toLowerCase() === 'generic-error-fragment'
    );

    // Hide all specific error messages
    genericErrorFragment.$items.forEach(item => {
        if (item.$fieldType === 'plain-text' && item.$name.startsWith('err')) {
            globals.functions.setProperty(item, { visible: false });
        }
    });

    // Show generic error message
    const genericError = genericErrorFragment.$items.find(item =>
        item.$fieldType === 'plain-text' && item.$name.toLowerCase() === 'generic-error-message'
    );

    if (genericError) {
        globals.functions.setProperty(genericError, { visible: true });
    }
}

/**
 * Attach a click handler to the Save button on the Update Profile template.
 *
 * When the save button is clicked, it triggers the
 * `handleUpdateProfileSubmitAction` function.
 *
 * @param {scope} globals
 */
function commonAPISubmissionSuccess(apiResponse, globals) {

    var response = apiResponse && apiResponse.event && apiResponse.event.payload && apiResponse.event.payload.body
        ? apiResponse.event.payload.body
        : {};

    var rawFormSubmitInfo = response.metadata ? response.metadata.FormSubmitInfo : null;

    var formSubmitInfo = JSON.parse(rawFormSubmitInfo);

    if (formSubmitInfo && formSubmitInfo.IsStatusSuccessful) {

        // Analytics
        if (analyticspayload && analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName('submit');
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent();
        }

        // Handle ContentResult
        var contentResult = formSubmitInfo.ContentResult;

        if (contentResult && contentResult.AuthToken) {
            setCookie('admp_login_token', contentResult.AuthToken, true, COOKIE_LIFE_COMPLETE_REBATE_LOGIN);
        }

        // Redirect
        if (formSubmitInfo.redirectSuccessUrl) {
            baseURLRedirection(formSubmitInfo.redirectSuccessUrl);
        }

    } else {
        admp_analytics_functions.onFormSubmitError(formSubmitInfo);
        baseHandleErrorResponse(formSubmitInfo);
    }
}


/**
 * Handles the Cancel button on the Update Profile template using plain JS.
 *
 * - Scrolls the form to the top
 * - Opens the modal
 * - On OK click: closes modal and navigates to rebate home page
 * - On Cancel click: simply closes the modal
 *
 * Note: Works only in runtime forms, not in template preview.
 * @param {string} navUrl
 * @param {scope} globals
 */
function handleUpdateProfileCancel(navUrl, globals) {
    scrollTopOnFormInit();
    modalOpen();

    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);
    // OK button click
    var okBtn = document.querySelector(".abbv-qPoll #okBtn");
    if (okBtn) {
        okBtn.addEventListener("click", function () {
            modalClose();
            window.location.assign(navUrl);
        });
    }

    // Cancel button click
    var cancelBtn = document.querySelector(".abbv-qPoll #cancelBtn");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", function () {
            modalClose();
        });
    }
}

function scrollTopOnFormInit() {
    window.scrollTo(0, 0);
}

/**
 * Utility function to validate an address value.
 * Returns true if value is null/empty, or passes the baseValidateAddress check.
 *
 * @param {string|null} value - The input value to validate.
 * @returns {boolean} - True if valid, false otherwise.
 */
function validateAddress2Field(value) {
    if (value !== null && value !== undefined && value !== "") {
        return baseValidateAddress(value) ? true : false;
    } else {
        return true;
    }
}
/**
 * Pre-populates the Complete Rebate user profile panel.
 *
 * This function is used on a temporary basis when backend services
 * are not available. It creates a mock payload object and uses it
 * to populate Adaptive Form profile fields.
 *
 * It also dynamically populates the Savings Card radio button list
 * if savings card data is available in the payload.
 *
 * NOTE:
 * - This mock data must be removed once backend integration is complete.
 * - Field values must match Adaptive Form field configurations
 *   (dropdown values, date formats, etc.).
 * - This function is intended to be executed on panel or form initialize.
 * @param {scope} globals
 */
function basePopulateCompleteRebateProfile(payloadContent, globals) {
    const currentField = globals.event.target;

    globals.functions.setProperty(currentField.profileFirstName, { value: payloadContent.FirstName });
    globals.functions.setProperty(currentField.profileLastName, { value: payloadContent.LastName });
    globals.functions.setProperty(currentField.emailAddress, { value: payloadContent.EmailAddress });
    globals.functions.setProperty(currentField.address1, { value: payloadContent.StreetAddress });
    globals.functions.setProperty(currentField.address2, { value: payloadContent.StreetAddress2 });
    globals.functions.setProperty(currentField.city, { value: payloadContent.City });
    globals.functions.setProperty(currentField.gender, { value: payloadContent.Gender });
    globals.functions.setProperty(currentField.dateOfBirth, { value: payloadContent.DateofBirth });
    globals.functions.setProperty(currentField.stateDropdown, { value: payloadContent.State });
    globals.functions.setProperty(currentField.zipCode, { value: payloadContent.ZIPCode });
    if (payloadContent.PrimaryPhone) {
        globals.functions.setProperty(currentField.primaryPhone, { value: payloadContent.PrimaryPhone });
    }

}

/**
 * Pre-populates the Complete Rebate user profile panel
 *
 * @param {object} payloadContent
 * @param {scope} globals
 */
function basePopulateCompleteRebateProfileV1(payloadContent, globals) {
    const currentField = globals.event.target;
    var hiddenPanel = currentField.$parent ? currentField.$parent.hiddenPanel : null;

    /**
     * Helper to set value safely
     */
    const setVal = (field, value) => {
        if (field !== undefined && value !== undefined && value !== null) {
            globals.functions.setProperty(field, { value });
        }
    };

   // Common Field mapping
       var FIELD_MAPPING = {
           profileFirstName: "FirstName",
           profileLastName: "LastName",
           emailAddress: "EmailAddress",
           address1: "StreetAddress",
           address2: "StreetAddress2",
           city: "City",
           dateOfBirth: "DateofBirth",
           stateDropdown: "State",
           zipCode: "ZIPCode",
           sex: "Gender",
           genderIdentity: "GenderIdentity",
           indicationId: "PrimaryIndicationId",
           primaryPhone: "PrimaryPhone"
       };

       // Populate common fields
       var populateCommonFields = function () {
           Object.keys(FIELD_MAPPING).forEach(function (fieldKey) {
               var payloadKey = FIELD_MAPPING[fieldKey];
               if (currentField && currentField[fieldKey]) {
                   setVal(currentField[fieldKey], payloadContent[payloadKey]);
               }
           });

           if (
               payloadContent &&
               payloadContent.PrimaryPhone &&
               payloadContent.PrimaryPhone === payloadContent.MobilePhoneNumber &&
               currentField.mobilePhoneCheckbox
           ) { // if primary phone and mobile phone number are equal then check 'This is a mobile phone (Optional)' field
               setVal(currentField.mobilePhoneCheckbox, 'true');
           }
       };

    /**
     * Adding the pediatric patient details
     */
    var isPediatric = !!payloadContent.PediatricPatient; // check pediatric patient data available
    /**
     * Populate pediatric patient details
     */
    if (isPediatric && hiddenPanel) {
        var pediatric = payloadContent.PediatricPatient;
        var pediatricPatientDetail = currentField.pediatricPatientDetail;
        var caretakerPanel = hiddenPanel.caretakerPanel;

        setVal(hiddenPanel.isChildPatient, 'true'); // child patient flag
        if (pediatricPatientDetail) {
            globals.functions.setProperty(pediatricPatientDetail, { visible: true });

            var childMapping = {
                childNextTreatmentDate: payloadContent.DateofNextTreatment,
                childFirstName: pediatric.PatientFirstName,
                childLastName: pediatric.PatientLastName,
                childDOB: pediatric.PatientDateOfBirth,
                childSex: pediatric.PatientGender
            };

            Object.keys(childMapping).forEach(function (key) {
                if (pediatricPatientDetail[key]) {
                    setVal(pediatricPatientDetail[key], childMapping[key]);
                }
            });

        }

        if (caretakerPanel) { // populate caretaker details (hidden fields)
            var caretakerMapping = {
                caretakerFirstName: payloadContent.FirstName,
                caretakerLastName: payloadContent.LastName,
                caretakerDOB: payloadContent.DateofBirth,
                caretakerSex: payloadContent.Gender,
                caretakerGenderIdentity: payloadContent.GenderIdentity
            };

            Object.keys(caretakerMapping).forEach(function (key) {
                if (caretakerPanel[key]) {
                    setVal(caretakerPanel[key], caretakerMapping[key]);
                }
            });
        }

    } else if (hiddenPanel && hiddenPanel.adultPatientPanel) { // populate adult patient (hidden fields)
        var adultPanel = hiddenPanel.adultPatientPanel;

        var adultMapping = {
            adultPatientFirstName: payloadContent.FirstName,
            adultPatientLastName: payloadContent.LastName,
            adultPatientDOB: payloadContent.DateofBirth,
            adultPatientSex: payloadContent.Gender,
            adultPatientGenderIdentity: payloadContent.GenderIdentity
        };

        Object.keys(adultMapping).forEach(function (key) {
            if (adultPanel[key]) {
                setVal(adultPanel[key], adultMapping[key]);
            }
        });
    }
    populateCommonFields(); // populate common fields
}

/**
 * Validates whether the given value is alphanumeric.
 *
 * @param {string} savingsCardId
 * @returns {boolean}
 */
function baseValidateAlphanumeric(savingsCardId) {
    // Regex to allow alphanumeric values with spaces or hyphens
    var savingsCardIdExp = /^\s*[a-zA-Z0-9]+(?:[\s-][a-zA-Z0-9]+)*\s*$/;

    return savingsCardIdExp.test(savingsCardId);
}

/**
 * Validates an Rx BIN value.
 *
 * - Checks if the value is alphanumeric.
 * - Ensures the length is either 6 or 8 characters.
 *
 * @param {Object} rxBix - The input field object containing a `$value` property.
 * @returns {boolean} True if the value is a valid Rx BIN, false otherwise.
 */
function crRxBinCheck(rxBix) {
    var flag = false;
    const val = rxBix.$value;
    if (baseValidateAlphanumeric(val)) {
        flag = val.length === 6 || val.length === 8;
    }
    return flag;
}

// ***** changes end ******

/**
 * Handles OTP-related submit actions (Get OTP / Validate OTP).
 *
 * @param {String} formAction - "GetOTP" or "ValidateOTP"
 * @param {Object} getOtpApiPanel - Get OTP panel reference
 * @param {Object} validateOtpApiPanel - Validate OTP panel reference
 * @param {scope} globals
 */
function baseOTPSubmitAction(formAction, getOtpApiPanel, validateOtpApiPanel, globals) {

    showLoader(true,"Submitting");

    var apiUrl = "/abbviecloud/bin/abbvie/apiproxy";
    var requestBody, onSuccess, onFailure;
    var validate = false;

    var exportedData = globals.functions.exportData() || {};

    /* --------------------------------------------------
     * GET OTP
     * -------------------------------------------------- */
    if (formAction === "GetOTP") {

        requestBody = exportedData.GetOtpApiRequest;

        var validationErrors = globals.functions.validate(getOtpApiPanel);
        validate = validationErrors.length === 0;

        admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);

        onSuccess = function (data) {
            showLoader(false);
            $(".verifyButton").prop("disabled", false);
            baseComRebGetOtpSuccess(
                data,
                getOtpApiPanel,
                validateOtpApiPanel,
                globals
            );
        };

        onFailure = function (error) {
            showLoader(false);
            console.error("Error in fetching OTP", error);
        };
    }

    /* --------------------------------------------------
     * VALIDATE OTP
     * -------------------------------------------------- */
    if (formAction === "ValidateOTP") {

        requestBody = exportedData.ValidateOtpApiRequest;

        var validationErrors = globals.functions.validate(validateOtpApiPanel);
        validate = validationErrors.length === 0;

        admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);

        onSuccess = function (data) {
            showLoader(false);
            if (data.IsStatusSuccessful == false) {
                globals.functions.setProperty(validateOtpApiPanel.otp, { valid: false, errorMessage: validateOtpApiPanel.err54055.$value });
                // disable button
                $(".verifyButton").prop("disabled", true);
            } else {
                baseComRebValidateOtpSuccess(
                    data,
                    getOtpApiPanel,
                    validateOtpApiPanel
                );
            }
        };

        onFailure = function (error) {
            showLoader(false);
            console.error("Error in validating OTP", error);
        };
    }

    if (!requestBody) {
        console.error("Request body missing in exportedData");
        showLoader(false);
        return;
    }

    /* --------------------------------------------------
     * Proxy payload
     * -------------------------------------------------- */
    var proxyPayload = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        payload: JSON.stringify(requestBody),
        actionType: window.abbviecloudforms.core.formProperties.apiType,
        originName: baseDetectDeviceType(),
        version: "V1",
        formAction: formAction
    };

    if (validate) {
        baseAjaxCall(
            apiUrl,
            "POST",
            JSON.stringify(proxyPayload),
            true,
            onSuccess,
            onFailure
        );
    } else {
        showLoader(false);
    }
}

function baseComRebGetOtpSuccess(response, getOtpApiPanel, validateOtpApiPanel,globals) {
    if (response && response.IsStatusSuccessful === true && response.ContentResult) {
        $('.generic-error-message').hide();
        $('.strikeiron-error-message').hide();
        baseClearAPIerrormessages("otp");
        baseDisableButton("verifyButton",false);
        $(".verifyButton button").prop('disabled', false);
        var result = response.ContentResult;
        sessionStorage.setItem('admp_crcheck',JSON.stringify(result));
        globals.functions.setProperty(getOtpApiPanel, {visible: false});
        globals.functions.setProperty(validateOtpApiPanel, {visible: true});
        var getEmailAddress = getOtpApiPanel.getEmailAddress.$value;
        globals.functions.setProperty(validateOtpApiPanel.validateEmailAddress, { value: getEmailAddress || '' });
        globals.functions.setProperty(validateOtpApiPanel.validateEmailAddress, { readOnly: true });
        if (result.IsNewRebateUser) {
            globals.functions.setProperty(validateOtpApiPanel.firstName, {visible: false});
            globals.functions.setProperty(validateOtpApiPanel.lastName, {visible: false});
            globals.functions.setProperty(validateOtpApiPanel.gender, {visible: false});
            globals.functions.setProperty(validateOtpApiPanel.dateOfBirth, {visible: false});
            globals.functions.setProperty(validateOtpApiPanel.zipcode, {visible: false});
        } else if (result.IsBAPIRegisteredUser && result.IsEmailAvailableForCRRegistration) {
            globals.functions.setProperty(validateOtpApiPanel.firstName, {visible: true});
            globals.functions.setProperty(validateOtpApiPanel.lastName, {visible: true});
            globals.functions.setProperty(validateOtpApiPanel.gender, {visible: false});
            globals.functions.setProperty(validateOtpApiPanel.dateOfBirth, {visible: false});
            globals.functions.setProperty(validateOtpApiPanel.zipcode, {visible: false});
        } else if (!result.IsBAPIRegisteredUser && result.IsEmailAvailableForCRRegistration) {
            globals.functions.setProperty(validateOtpApiPanel.firstName, {visible: true});
            globals.functions.setProperty(validateOtpApiPanel.lastName, {visible: true});
            globals.functions.setProperty(validateOtpApiPanel.gender, {visible: true});
            globals.functions.setProperty(validateOtpApiPanel.dateOfBirth, {visible: true});
            globals.functions.setProperty(validateOtpApiPanel.zipcode, {visible: true});
        }
    } else {
        baseHandleErrorResponse(response);
    }
}

function baseComRebValidateOtpSuccess(response, getOtpApiPanel, validateOtpApiPanel) {
    var cookie_life = 12 * 60 * 60;   // 12 hours

    if (response && response.IsStatusSuccessful === true && response.ContentResult) {
        if (analyticspayload.validPayload) {
            analyticspayload.getFormCompletePayload();
        } else {
            analyticsFormSubmitEvent(response);
        }
        var crCheck =  sessionStorage.getItem('admp_crcheck') ? JSON.parse(sessionStorage.getItem('admp_crcheck')) : '';
        var registrationpage = window.abbviecloudforms.core.formProperties.registrationthankyoupageurl;
        var claimspage = window.abbviecloudforms.core.formProperties.dsaregistrationthankyoupageurl;
        var result = response.ContentResult;
        deleteAllCRCookies();
        var completeSavingsCardList = [];
        if(result.CompleteEnrolled){
            completeSavingsCardList = result.CompleteEnrolled.SavingsCard !== null ? completeSavingsCardList.concat(result.CompleteEnrolled.SavingsCard) : completeSavingsCardList;
        }
        if(result.CompleteRebate){
            completeSavingsCardList = result.CompleteRebate.SavingsCard !== null ? completeSavingsCardList.concat(result.CompleteRebate.SavingsCard) : completeSavingsCardList;
        }
        //below code is used to filter unique savings card information. RXidentifier will be unique and hence being used below
        var uniqueCards = completeSavingsCardList.filter(function (obj, index) {
            return index === completeSavingsCardList.findIndex(function (o) {
                return obj.RxIdentifier === o.RxIdentifier;
            });
        });

        setCookie('admp_crsaveCard', JSON.stringify(uniqueCards), true, cookie_life);
        var getEmailAddress = getOtpApiPanel.getEmailAddress.$value;
        setCookie('admp_cremail', getEmailAddress , true, cookie_life);
        if (result.RequestDetails) {
            var encryptReq = window.sjcl.encrypt( '', JSON.stringify(result.RequestDetails));
            setCookie('admp_crrequestDetails', encryptReq, true, cookie_life);
        }
        if (result.AuthToken) {
            //Set it to 12 minutes, so that browser deletes it before token expires on server (15 min)
            setCookie('admp_login_token', result.AuthToken, true, COOKIE_LIFE_COMPLETE_REBATE_LOGIN);
        }

        if (crCheck.IsNewRebateUser) {
            //Calling getProfile to set user as logged in user for complete rebate
            if (window.abbviecloudforms.core.formProperties.brandName) {
               baseGetUserProfile(window.abbviecloudforms.core.formProperties.brandName,'originNameWeb');
            }
            if (result.CompleteRebateAccountId) {
               setCookie('admp_crid', JSON.stringify(result.CompleteRebateAccountId), true, cookie_life);
               var encryptCR = window.sjcl.encrypt( '', JSON.stringify(result.CompleteRebate));
               setCookie('admp_crprefill', encryptCR, true, cookie_life);
            }
            baseURLRedirection(claimspage);
        } else if (crCheck.IsBAPIRegisteredUser && crCheck.IsEmailAvailableForCRRegistration) {
            if (result.CompleteEnrolled) {
               var encryptCE = window.sjcl.encrypt( '',JSON.stringify(result.CompleteEnrolled));
               setCookie('admp_crprefill', encryptCE, true, cookie_life);
            }
            baseURLRedirection(registrationpage);
        } else if (!crCheck.IsBAPIRegisteredUser && crCheck.IsEmailAvailableForCRRegistration) {
            if (result.CompleteRebate) {
                var encryptCRO = window.sjcl.encrypt( '',JSON.stringify(result.CompleteRebate));
                setCookie('admp_crprefill', encryptCRO, true, cookie_life);
            }
            baseURLRedirection(registrationpage);
        }
    } else {
        admp_analytics_functions.onFormSubmitError(response);
		   if (response.IsStatusSuccessful === false) {
			if (response.ErrorResponseMessageList) {
				var errorList = response.ErrorResponseMessageList;
				for (var i = 0; i < errorList.length; i++) {
					var errorCode = errorList[i].ErrorCode;
					if (errorCode === "54053" || errorCode === "54054" ) {
						baseDisableButton("verifyButton", true);
						$(".verifyButton button").prop('disabled', true);
					}
				}
			}
		}
        baseHandleErrorResponse(response);
    }
}

/**
 * Handles Continue button click on Indication Form.
 *
 * @param {Object} guideRootPanel
 *        Root panel reference used for validation.
 *
 * @param {scope} globals
 */
function indicationFormContinueClick(indicationPanel, globals) {

    var exportedData = globals.functions.exportData() || {};

    // Validate the entire form / root panel
    var validationErrors = globals.functions.validate(indicationPanel);
    var isValid = validationErrors.length === 0;

    if (!isValid) {
        return;
    }

    // Redirect based on registration type
    if (exportedData.indicationPanel.formRegistrationType === "Yes") {
        redirectToThankYouPage(
            window.abbviecloudforms.core.formProperties
                .registrationthankyoupageurl
        );
    } else {
        redirectToThankYouPage(
            window.abbviecloudforms.core.formProperties
                .dsaregistrationthankyoupageurl
        );
    }
}

/**
 * Stores the selected indication value in a cookie if it has changed.
 *
 * @param {scope} globals
 */
function updateIndicationCookie(globals) {

    var exportedData = globals.functions.exportData() || {};

    var selectedValue = exportedData.indicationPanel.indicationOptionsRadioButton;
    var existingCookieValue = baseGetCookieValue("indicationName");

    if (selectedValue !== null && selectedValue !== existingCookieValue) {
        setCookie(
            "indicationName",
            selectedValue,
            true,
            365 * 24 * 60 * 60
        );
    }
}

/**
 * @name initQPollModal
 * @description
 * Opens the QPoll modal and binds click events
 * for OK and Cancel buttons.
 *
 * - Cancel button closes the modal
 * - OK button triggers Transcard URL logic
 * @param {scope} globals
 * @returns {void}
 */
function initQPollModal(globals) {

    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);
    // Open modal
    modalOpen();

    // Bind Cancel button
    $(".abbv-qPoll #cancelBtn").off("click").on("click", function () {
        modalClose();
    });

    // Bind OK button
    $(".abbv-qPoll #okBtn").off("click").on("click", function () {
        baseGetTranscardURL();
    });
}

function baseGetTranscardURL() {
    showLoader(true,"Submitting");

    var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
    var onSuccess, onFailure;

    onSuccess = function (data) {
        showLoader(false);

        if (data.IsStatusSuccessful) {
            var resultUrl = data.ContentResult.paymentAccountURL;
            resultUrl = resultUrl.replaceAll('"', '');

            window.parent.location.replace(resultUrl);
        } else {
            console.log('Error :: ' + data.ErrorResponseMessageList[0].ErrorCode + ' = ' + data.ErrorResponseMessageList[0].ErrorMessage);
            baseHandleErrorResponse(data);
        }
    };

    onFailure = function (error) {
        showLoader(false);
        console.error('Error in fetching ' + proxyPayload.formAction + ' ', error);
    };

    var url = new URL(window.parent.location.href);

    if (url.searchParams.get('result') !== 'true') {
        url.searchParams.set('result', 'true');
    }

    var requestBody = {
        PageReturnURL: url.toString()
    };

    var proxyPayload = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        actionType: 'BrandAPI',
        originName: baseDetectDeviceType(),
        payload: JSON.stringify(requestBody),
        requestType: 'POST',
        version: 'V1',
        formAction: 'GetPaymentAccountURL'
    };

    baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyPayload), true, onSuccess, onFailure);
}

/**
 * @name redirectToClaimsPageRebateClaimClick
 * @description
 * Redirects the user to the Claims page based on profile cookie availability.
 *
 * Workflow:
 * - Checks if the profile cookie (`admp_cr_ng_profile`) exists.
 * - If present, redirects immediately to the Claims page.
 * - If not present:
 *   1. Calls the API to fetch the Complete Rebate Profile.
 *   2. Polls for the profile cookie.
 *   3. Redirects once the cookie is set (or stops after timeout).
 *
 * @param {Object} claimUrl
 *        The URL of the Claims page where the user should be redirected.
 *
 * @param {Object} loginUrl
 *        The Login page URL used if profile retrieval fails
 *        or authentication is required.
 *
 * @param {scope} globals
 *        Adaptive Forms runtime scope object used for
 *        accessing form functions and utilities.
 *
 * @returns {void}
 */
function redirectToClaimsPageRebateClaimClick(claimUrl, loginUrl, globals) {
    showLoader(true,"Submitting");
    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);

    var profileValue = baseGetCookieValue('admp_cr_ng_profile');

    if (profileValue === "true") {
        baseURLRedirection(claimUrl);
        showLoader(false);
    } else {
        baseGetClaimHistoryOrGetProfile('GetCompleteRebateProfile', loginUrl, globals);
        waitForProfileCookieAndRedirect(3000, 300, claimUrl);
    }
}


/**
 * Polls for profile cookie and redirects
 */
function waitForProfileCookieAndRedirect(maxWait, interval, url) {
    var waited = 0;

    var timer = setInterval(function () {
        var profileValue = baseGetCookieValue('admp_cr_ng_profile');

        if (profileValue) {
            clearInterval(timer);
            baseURLRedirection(url);
        } else {
            waited += interval;

            if (waited >= maxWait) {
                clearInterval(timer);
                showLoader(false);
            }
        }
    }, interval);
}

/**
 * Fetches either Claim History or Complete Rebate Profile from Brand API.
 *
 * This function:
 * - Calls backend proxy API to retrieve data.
 * - Handles token expiration scenarios.
 * - Populates claim history panel OR stores encrypted profile data in cookie.
 * - Manages specific API error codes and fallback handling.
 *
 * @function baseGetClaimHistoryOrGetProfile
 *
 * @param {string} formAction
 *        API action to execute.
 *        Supported values:
 *        - "GetClaims"
 *        - "GetCompleteRebateProfile"
 *
 * @param {string} logInUrl
 *        Login page URL to redirect when token is invalid or expired.
 *
 * @param {Object} claimHistoryPanel
 *        Adaptive Form panel reference used to populate claim history data.
 *        Required when formAction is "GetClaims".
 *
 * @param {scope} globals
 *        Global form scope object used for updating panel data.
 *
 * @returns {void}
 *
 * @example
 * baseGetClaimHistoryOrGetProfile(
 *     'GetClaims',
 *     logInUrl.value,
 *     claimHistoryPanel,
 *     globals
 * );
 */
function baseGetClaimHistoryOrGetProfile(formAction, logInUrl, claimHistoryPanel, globals) {
    showLoader(true,"Submitting");

    var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
    var onSuccess, onFailure;

    var historyErrorCodes = ['51033', '51156', '60023'];

    onSuccess = function (data) {
        var errCode;
        showLoader(false);

        if (data.ErrorResponseMessageList) {
            errCode = data.ErrorResponseMessageList[0].ErrorCode;
        }

        if (data.IsStatusSuccessful) {
            if (formAction === 'GetCompleteRebateProfile') {
                var encryptRes = window.sjcl.encrypt('', JSON.stringify(data.ContentResult));
                setCookie('admp_cr_ng_profile', encryptRes, true, 365 * 24 * 60 * 60);
            } else {
                basePopulateClaimHistory(JSON.stringify(data.ContentResult), claimHistoryPanel, globals);
            }
        } else if (errCode === '12012') {
            console.log('baseGetClaimHistoryOrGetProfile-' + formAction + ' :: ' + errCode + ' = ' + data.ErrorResponseMessageList[0].ErrorMessage);

            if (baseGetCookieValue('admp_login_token')) {
                baseBrandAPIRefreshLogin();
                window.location.reload();
            } else {
                deleteAllCRCookies();
                window.parent.location.href = logInUrl;
            }
        } else if (historyErrorCodes.indexOf(errCode) > -1) {
            console.log('GetClaims API Response Error :: ' + errCode + ' = ' + data.ErrorResponseMessageList[0].ErrorMessage);

            if (formAction === 'GetClaims') {
                basePopulateClaimHistory(JSON.stringify(data.ContentResult), claimHistoryPanel, globals);
            }
        } else {
            console.log('baseGetClaimHistoryOrGetProfile-' + formAction + ' :: ' + errCode + ' = ' + data.ErrorResponseMessageList[0].ErrorMessage);
            baseHandleErrorResponse(data);
        }
    };

    onFailure = function (error) {
        showLoader(false);
        console.error('baseGetClaimHistoryOrGetProfile-' + formAction + ' :: fetching ' + formAction + ' ', error);
    };

    var proxyPayload = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        actionType: window.abbviecloudforms.core.formProperties.apiType || 'BrandAPI',
        originName: baseDetectDeviceType(),
        payload: '{}',
        requestType: 'GET',
        version: 'V1',
        formAction: formAction
    };

    var resetTokenCount = 0;
    var resetTokenInterval = setInterval(function () {
        resetTokenCount++;

        if (window.parent.refreshTokenWaiting && resetTokenCount > 20) {
            clearInterval(resetTokenInterval);
            showLoader(false);
            console.log('baseGetClaimHistoryOrGetProfile-' + formAction + ' :: token check failed');
        } else {
            clearInterval(resetTokenInterval);
            baseAjaxCall(apiUrl, 'POST', JSON.stringify(proxyPayload), false, onSuccess, onFailure);
        }
    }, 500);
}

function basePopulateClaimHistory(payload, claimHistoryPanel, globals) {
    if (payload && payload !== 'undefined' && payload !== 'null') {
        globals.functions.setProperty(claimHistoryPanel.noResultsPanel, {visible: false});
        globals.functions.setProperty(claimHistoryPanel.contentPanel, {visible: true});
        baseSetClaims(JSON.parse(payload), claimHistoryPanel, globals);
    } else {
        globals.functions.setProperty(claimHistoryPanel.contentPanel.historyPanel_0, {visible: false});
        globals.functions.setProperty(claimHistoryPanel.contentPanel.claimsText_01, {visible: false});
        globals.functions.setProperty(claimHistoryPanel.noResultsPanel, {visible: true});
    }
}

function baseSetClaims(payload, claimHistoryPanel, globals) {
    var claimObjects = payload.Claims;
    var noOfClaims = claimObjects.length;

    for (var i = 0; i < noOfClaims && i < 10; i++) {
        setClaimHistoryValues(claimHistoryPanel.contentPanel['historyPanel_' + i], claimObjects[i], i, globals);
    }
}

function setClaimHistoryValues(historyPanelObj, claim, count, globals) {
    globals.functions.setProperty(historyPanelObj, {visible: true});
    updateFormDisplayTextFieldValue(historyPanelObj.claimNumber, claim.ClaimNumber);
    updateFormDisplayTextFieldValue(historyPanelObj.dateSubmitted, convertUTCDateToMMDDYYYY(claim.ClaimDate));
    if(claim.SubmittedAmount && claim.SubmittedAmount !== 'undefined')
        updateFormDisplayTextFieldValue(historyPanelObj.submittedAmount, '$'+claim.SubmittedAmount);
    updateFormDisplayTextFieldValue(historyPanelObj.claimStatus, claim.Status);
    globals.functions.setProperty(historyPanelObj['claimId_' + count], { value: claim.ClaimId });
    var claimAttachments = claim.AttachedFiles;
    var attachmentCount = claimAttachments.length;

    if(attachmentCount){
        globals.functions.setProperty(historyPanelObj['responseFileNames_' + count], { value: claim.AttachedFiles });
    }
    var files = "";
    for (var i = 0; i < attachmentCount; i++) {
        files = files + "<br>" + claimAttachments[i];
    }

    updateFormDisplayTextFieldValue(historyPanelObj.claimExpandPanel.claimSavingsCardRXNumber, claim.SavingsCardRxId);
    updateFormDisplayTextFieldValue(historyPanelObj.claimExpandPanel.attachedFiles, files);
    if(claim.PrescriptionFillDate)
        updateFormDisplayTextFieldValue(historyPanelObj.claimExpandPanel.claimDateFilled, convertUTCDateToMMDDYYYY(claim.PrescriptionFillDate));

    if(claim.Status && claim.Status !== 'undefined' && claim.Status !== 'null'){
     var claimStatus = claim.Status.toUpperCase();
     if (claimStatus !== 'REJECTED'  && claimStatus !== 'PAYMENT AUTHORIZED'){
		globals.functions.setProperty(historyPanelObj.claimExpandPanel.fileUploadPanel, {visible: true});
     }
    }
    if(claim.RebateAmount && claim.RebateAmount !== 'null'){
        updateFormDisplayTextFieldValue(historyPanelObj.claimExpandPanel.rebateAmount, '$'+claim.RebateAmount);
    }
}

function updateFormDisplayTextFieldValue(textObject, appendValue) {
    var textNew = textObject.$value || "";

    if (appendValue && appendValue !== 'undefined') {
        textNew += appendValue;
    }

    $("#" + textObject.$id).html(textNew);
}

/**
 * @name triggerGetClaims
 * @description
 * Triggers the GetClaims API call after a short delay.
 * This is mainly used to ensure required data or UI
 * components are fully initialized before execution.
 *
 * @param {Object} logInUrl - Login URL value used for API redirection.
 * @param {Object} claimHistoryPanel - Panel/component reference for claim history UI.
 * @param {scope} globals
 * @returns {void}
 */
function triggerGetClaims(loginUrl, claimHistoryPanel,globals) {
    setTimeout(function () {
        baseGetClaimHistoryOrGetProfile(
            'GetClaims',
            loginUrl,
            claimHistoryPanel,
            globals
        );
    }, 500);
}

function baseDisableButton(buttonClass, disable) {
    let disableRARSearchButton = false; // this variable is not used anywhere. where are we using it?It should be removed if not used.
    if (disable) {
        disableRARSearchButton = true;
        $('.' + buttonClass + ' button').css({ 'cursor': 'not-allowed' });
        $('.' + buttonClass + ' button').attr('data-disabled', true);
    } else {
        disableRARSearchButton = false;
        $('.' + buttonClass + ' button').css({ 'cursor': 'pointer' });
        $('.' + buttonClass + ' button').attr('data-disabled', false);
    }
}


/*
 Function to delete all the Complete rebate cookies.
*/
function deleteAllCRCookies(){
   deleteCookie('admp_crid');
   deleteCookie('admp_crprefill');
   deleteCookie('admp_cremail');
   deleteCookie('admp_crsaveCard');
   deleteCookie('admp_crindication');
   deleteCookie('admp_crrequestDetails');
   deleteCookie('admp_login_token');
   deleteCookie('admp_cr_ng_profile');
}

/**
 * Redirects user using existing handler methods based on login token.
 *
 * @param {Object} claimsUrl - Claims page URL.
 * @param {Object} logInUrl  - Login page URL.
 * @param {scope} globals
 * @returns {void}
 */
function baseHandleClaimsRedirect(claimsUrl, logInUrl, globals) {
    var claimsUrlValue = getValue(claimsUrl);
    var logInUrlValue = getValue(logInUrl);
    var loginToken = baseGetCookieValue('admp_login_token');

    if (loginToken) {
        redirectToClaimsPage(claimsUrlValue, logInUrlValue, globals);
    } else {
        invalidEntry(logInUrlValue);
    }
}

/**
 * Utility function to safely extract a value.
 * If the input is a string, it returns it.
 * If the input is an object with a $value property, it returns $value.
 */
function getValue(input) {
    if (typeof input !== "string") {
        return input.$value;
    }
    return input;
}

function redirectToClaimsPage(claimsUrl, logInUrl,globals) {
  showLoader(true,"Submitting");
  var profileValue = baseGetCookieValue('admp_cr_ng_profile');
  if (profileValue) {
     baseGetUserProfile('fm-brandname-skyrizi', 'originNameWeb');
     baseURLRedirection(claimsUrl, globals);
     showLoader(false);
  } else {
    baseGetUserProfile('fm-brandname-skyrizi', 'originNameWeb');
    baseGetClaimHistoryOrGetProfile('GetCompleteRebateProfile', logInUrl, null, globals);
    waitForProfileCookieAndRedirect(5000, 300, claimsUrl); // Wait up to 5s, check every 300ms
  }
}

//redirect user to base page if user hits any saved links directly.
function invalidEntry(redirect) {
    if (!baseGetCookieValue('admp_cremail') || !baseGetCookieValue('admp_login_token')) {
        if (!isEnvironmentAuthor()) {
            window.parent.location.href = redirect;
        }
    } else {
        return true;
    }
}
function baseBrandAPIRefreshLogin() {
    var payload = {
        oldToken: baseGetCookieValue('admp_login_token'),
      	brandName: window.abbviecloudforms.core.formProperties.brandName || 'fm-brandname-skyrizi'
    };

   var proxyPayload = {
        brandName: window.abbviecloudforms.core.formProperties.brandName,
        actionType: window.abbviecloudforms.core.formProperties.apiType,
        originName: baseDetectDeviceType(),
        payload: payload,
        requestType: 'POST',
        version: 'V1',
        formAction: "RefreshLogin"
    };

    var refreshToken_api_url= "/abbviecloud/bin/abbvieforms/refreshlogin";
    baseAjaxCall(refreshToken_api_url, 'POST', JSON.stringify(proxyPayload), false, onSuccessTokenCall, onFailedTokenCall);
    function onSuccessTokenCall(data) {
        if (data.IsStatusSuccessful) {
            var newToken = data.ContentResult ||data.admp_login_token;
            //Set it to 12 minutes, so that browser deletes it before token expires on server (15 min)
          	setCookie('admp_login_token', newToken, true, COOKIE_LIFE_COMPLETE_REBATE_LOGIN);
            return true;
        } else {
            console.log("baseBrandAPIRefreshLogin :: onSuccessTokenCall:: response :: "+ data.IsStatusSuccessful);
            return false;
        }
    }
    function onFailedTokenCall(data) {
        console.log("baseBrandAPIRefreshLogin :: onFailedTokenCall :: response "+ data);
        return false;
    }
}

/**
 * Prefills claims form using sessionStorage, IndexedDB, cookie profile, or backend call.
 *
 * @param {string} queryStr
 * @param {object} panelObj - Root claims panel object
 * @param {object} loginUrl - Login URL field object
 * @param {scope} globals
 */
function prefillClaimsData(queryStr, panelObj, loginUrl, globals) {
    var urlParam = baseUrlGetParam(queryStr);
    var storedForm = sessionStorage.getItem('admp_patientFormSubmission');
    var pedFormDetails = sessionStorage.getItem('admp_PEDFormDetails');
	
    // Returning from submission
    getAdmpStorageItem('admp_imagVal').then(function(storedImages) {
        if (urlParam && storedForm && storedImages) {
            if (urlParam === 'true') {
                // Decrypt form details
                if (storedForm) {
                    var decryptCRDetails = window.parent.sjcl.decrypt('', storedForm);
                    if (decryptCRDetails) {
                        prefillFormDetails(decryptCRDetails,panelObj,globals);
                    }
                }

                // Decrypt image details
                if (storedImages) {
                    var imgData = window.parent.sjcl.decrypt('', storedImages);
                    if (imgData) {
                        prefillImageDetails(imgData,panelObj,globals);
                    }
                }
                // Toggle visibility
                globals.functions.setProperty(panelObj.claimsDetailsPanel.claimsPanel,{ visible: false });
                globals.functions.setProperty(panelObj.claimsDetailsPanel.distributionDetailsPanel,{ visible: true });
                globals.functions.setProperty(panelObj.claimsDetailsPanel.distributionDetailsPanel.toolbarPanel.distributionBackButton, { visible: false });
				//Decrypt PED details
				if (pedFormDetails) {
					var decryptPEDDetails = window.parent.sjcl.decrypt('', pedFormDetails);
					if (decryptPEDDetails) {
						prefillPEDDetails(decryptPEDDetails,panelObj,globals);
					}
				}
            }
        } else {
            // Check if profile cookie exists
            var profileCookie = baseGetCookieValue('admp_cr_ng_profile');
            if (profileCookie) {
                getProfileDetails(panelObj, globals);
            } else {
                // Call backend
                baseGetClaimHistoryOrGetProfile('GetCompleteRebateProfile',loginUrl.$value,globals);
                if (baseGetCookieValue('admp_cr_ng_profile')) {
                    getProfileDetails(panelObj, globals);
                }
            }
        }
    });
}

/**
 * Retrieves and applies user profile details from stored cookies.
 *
 * @param {Object} panelObj Root panel reference
 * @param {scope} globals
 */
function getProfileDetails(panelObj, globals) {
    // Clear previous state
    deleteCookie('admp_crindication');
    sessionStorage.removeItem('admp_patientFormSubmission');
	sessionStorage.removeItem('admp_PEDFormDetails');
    removeAdmpStorageItem('admp_imagVal');

    var requestDetails = getDecryptedvalue('admp_cr_ng_profile');
    if (requestDetails) {
        var primaryIndication = requestDetails.PrimaryIndicationId;

        // Safe fallback
        if (primaryIndication === null || primaryIndication === undefined) {
            var defaultIndicationValue = null;
            if (panelObj && panelObj.defaultIndication && panelObj.defaultIndication.$value) {
                defaultIndicationValue = panelObj.defaultIndication.$value;
            }
            primaryIndication =(defaultIndicationValue && defaultIndicationValue !== 'undefined')? defaultIndicationValue: '2';
        }
        // Set indication cookie
        setCookie('admp_crindication', primaryIndication,true,365 * 24 * 60 * 60);
        hideShowclaimsSection(primaryIndication, panelObj, globals); // Control visibility / sections
        updateClaimsdetails(requestDetails, panelObj, globals); // Populate form details
        var pediatricPatientObj = requestDetails.PediatricPatient;
        if (pediatricPatientObj) {
          updatePEDFieldsFromRequest(requestDetails,panelObj,globals); //Populate PED details
        }
    }
}

/**
 * Show/hide sections based on indication cookie value.
 *
 * @param {string} indicationCookieValue
 * @param {Object} panelObj  Root panel reference
 * @param {scope} globals
 */
function hideShowclaimsSection(indicationCookieValue, panelObj, globals) {
    var nonGastroInd = '';

    if (panelObj && panelObj.nonGastroHiddenValues && panelObj.nonGastroHiddenValues.$value) {
        nonGastroInd = panelObj.nonGastroHiddenValues.$value;
    }
    var nonGastroFlag = nonGastroInd.indexOf(indicationCookieValue) > -1;
    var claimPanel = panelObj.claimsDetailsPanel.claimsPanel;

    if (indicationCookieValue && nonGastroFlag) {
        // Non-gastro user
        globals.functions.setProperty(claimPanel.nonGastroClaims, { visible: true });
        globals.functions.setProperty(claimPanel.gastroClaims, { visible: false });
        globals.functions.setProperty(claimPanel.amountPaidUploadSection, { visible: true });
        globals.functions.setProperty(claimPanel.savingsCardDetailsPanel, { visible: true });
        globals.functions.setProperty(panelObj.updateProfileFlag, { value: true });
        globals.functions.setProperty(panelObj.claimsDetailsPanel.distributionDetailsPanel.distribution.distributionMethodPanel,{ visible: true });
    } else {
        // Gastro user
        globals.functions.setProperty(claimPanel.nonGastroClaims, { visible: false });
        globals.functions.setProperty(claimPanel.gastroClaims, { visible: true });
        globals.functions.setProperty(claimPanel.amountPaidUploadSection, { visible: false });
        globals.functions.setProperty(claimPanel.savingsCardDetailsPanel, { visible: false });
    }
}

/**
 * Populate claim form details from decrypted profile.
 *
 * @param {Object} requestDetails  Decrypted profile data
 * @param {Object} panelObj  Root panel reference
 * @param {scope} globals
 */
function updateClaimsdetails(requestDetails, panelObj, globals) {
    if (!requestDetails) return;
    updateReviewFieldsFromRequest(requestDetails,panelObj);

    var editPanel = panelObj.claimsDetailsPanel.distributionDetailsPanel.distribution.checkByMailDetails.personalDetailsPanel.editablePanel;
    var hiddenPerDetailPanel = panelObj.claimsDetailsPanel.reviewPanel.hiddenProfileDetailsSection;
    var savingCardPanel = panelObj.claimsDetailsPanel.claimsPanel.savingsCardDetailsPanel.savingCards;
    var textPanel = panelObj.claimsDetailsPanel.reviewPanel.completeRebateTextMessagePanel.optinOptions;

    // Personal info
    globals.functions.setProperty(editPanel.firstName, { value: requestDetails.FirstName });
    globals.functions.setProperty(editPanel.lastName, { value: requestDetails.LastName });
    editPanel.dateofBirth && globals.functions.setProperty(editPanel.dateofBirth, { value: requestDetails.DateofBirth });
    editPanel.sex && globals.functions.setProperty(editPanel.sex, { value: requestDetails.Gender });
    editPanel.genderIdentity && globals.functions.setProperty(editPanel.genderIdentity, { value: requestDetails.GenderIdentity });
    globals.functions.setProperty(editPanel.addresspanel.streetAddress, { value: requestDetails.StreetAddress });
    globals.functions.setProperty(editPanel.addresspanel.streetAddress2, { value: requestDetails.StreetAddress2 });
    globals.functions.setProperty(editPanel.addresspanel.city, { value: requestDetails.City });
    globals.functions.setProperty(editPanel.addresspanel.stateDropdown, { value: requestDetails.State });
    globals.functions.setProperty(editPanel.addresspanel.editZipcode, { value: requestDetails.ZIPCode });

    // Hidden fields
    globals.functions.setProperty(hiddenPerDetailPanel.hiddenPhoneNumber, { value: requestDetails.PrimaryPhone });
    globals.functions.setProperty(hiddenPerDetailPanel.hiddenDOB, { value: requestDetails.DateofBirth });
    globals.functions.setProperty(hiddenPerDetailPanel.hiddenMarkOptInFlag, { value: requestDetails.MarketingOptIn });
    globals.functions.setProperty(hiddenPerDetailPanel.hiddenSMSOptInFlag, { value: requestDetails.SMSMMSOptIn });

    var phFormat = requestDetails.PrimaryPhone ? requestDetails.PrimaryPhone.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'): ""; // Formatted phone
    globals.functions.setProperty(textPanel.phoneFormatted, { value: phFormat });
    setSavingsCardDetails(requestDetails.SavingsCards, savingCardPanel, globals); // Savings cards
}

/**
 * Updates review display fields using requestDetails
 *
 * @param {object} requestDetails
 * @param {object} panelObj
 */
function updateReviewFieldsFromRequest(requestDetails,panelObj) {
    if (!requestDetails) return;

    //Update the review panel UI using the text field id's
    var reviewPanel= panelObj.claimsDetailsPanel.reviewPanel;

    updateFormDisplayTextFieldValue(reviewPanel.emailaddress, requestDetails.EmailAddress);
    updateFormDisplayTextFieldValue(reviewPanel.fname, requestDetails.FirstName);
    updateFormDisplayTextFieldValue(reviewPanel.lname, requestDetails.LastName);
    reviewPanel.reviewDateofBirth && updateFormDisplayTextFieldValue(reviewPanel.reviewDateofBirth, requestDetails.DateofBirth);
    reviewPanel.reviewSex && updateFormDisplayTextFieldValue(reviewPanel.reviewSex, requestDetails.Gender);
    reviewPanel.reviewGenderIdentity && updateFormDisplayTextFieldValue(reviewPanel.reviewGenderIdentity, requestDetails.GenderIdentity);
    updateFormDisplayTextFieldValue(reviewPanel.reviewstreetaddress, requestDetails.StreetAddress);
    updateFormDisplayTextFieldValue(reviewPanel.streetaddress2, requestDetails.StreetAddress2);
    updateFormDisplayTextFieldValue(reviewPanel.reviewcity, requestDetails.City);
    updateFormDisplayTextFieldValue(reviewPanel.reviewstate, requestDetails.State);
    updateFormDisplayTextFieldValue(reviewPanel.revzipcode, requestDetails.ZIPCode);
    updateFormDisplayTextFieldValue(reviewPanel.primaryphone, requestDetails.PrimaryPhone);

    // Updates the personalDetails ReviewPanel UI using the text field id's
    var personalDetailsReviewPanel = panelObj.claimsDetailsPanel.distributionDetailsPanel.distribution.checkByMailDetails.personalDetailsPanel.reviewPanel;

    var username =(requestDetails.FirstName || "") + " " +(requestDetails.LastName || "");
    updateFormDisplayTextFieldValue(personalDetailsReviewPanel.username, username.trim());

    var address =(requestDetails.StreetAddress || "") + " " +(requestDetails.StreetAddress2 || "");
    updateFormDisplayTextFieldValue(personalDetailsReviewPanel.address, address.trim());

    var cityState =(requestDetails.City || "") + ", " +(requestDetails.State || "");
    updateFormDisplayTextFieldValue(personalDetailsReviewPanel.viewcity, cityState.replace(/^,\s*/, ""));

    updateFormDisplayTextFieldValue(personalDetailsReviewPanel.viewzipcode, requestDetails.ZIPCode);
}

/**
 * Populates Adaptive Form fields using decrypted claim data.
 *
 * @param {String} rawData  JSON string containing decrypted claim form data
 * @param {Object} panelObj Root panel reference
 * @param {scope} globals
 */
function prefillFormDetails(rawData, panelObj, globals) {
    var data = JSON.parse(rawData);
    var email = baseGetCookieValue("admp_cremail");// Email

    //Update the personalDetails ReviewPanel UI using the text field id's
    var personalDetailsReviewPanel = panelObj.claimsDetailsPanel.distributionDetailsPanel.distribution.checkByMailDetails.personalDetailsPanel.reviewPanel;

    var username =((data.firstName || "") + " " + (data.lastName || "")).trim();
    updateFormDisplayTextFieldValue(personalDetailsReviewPanel.username, username);

    var address =((data.streetAddress || "") + " " + (data.streetAddress2 || "")).trim();
    updateFormDisplayTextFieldValue(personalDetailsReviewPanel.address, address.trim());

    var cityState =((data.city || "") + ", " + (data.stateDropDown || "")).replace(/^,\s*/, "");
    updateFormDisplayTextFieldValue(personalDetailsReviewPanel.viewcity, cityState);

    updateFormDisplayTextFieldValue(personalDetailsReviewPanel.viewzipcode, data.editZipcode);

    //Update the review panel UI using the text field id's
    var reviewPanel= panelObj.claimsDetailsPanel.reviewPanel;

    updateFormDisplayTextFieldValue(reviewPanel.emailaddress, email);
    updateFormDisplayTextFieldValue(reviewPanel.fname, data.firstName);
    updateFormDisplayTextFieldValue(reviewPanel.lname, data.lastName);
    reviewPanel.reviewDateofBirth && updateFormDisplayTextFieldValue(reviewPanel.reviewDateofBirth, data.DateofBirth);
    reviewPanel.reviewSex && updateFormDisplayTextFieldValue(reviewPanel.reviewSex, data.Gender);
    reviewPanel.reviewGenderIdentity && updateFormDisplayTextFieldValue(reviewPanel.reviewGenderIdentity, data.GenderIdentity);
    updateFormDisplayTextFieldValue(reviewPanel.reviewstreetaddress, data.streetAddress);
    updateFormDisplayTextFieldValue(reviewPanel.streetaddress2, data.streetAddress2);
    updateFormDisplayTextFieldValue(reviewPanel.reviewcity, data.city);
    updateFormDisplayTextFieldValue(reviewPanel.reviewstate, data.stateDropDown);
    updateFormDisplayTextFieldValue(reviewPanel.revzipcode, data.editZipcode);
    updateFormDisplayTextFieldValue(reviewPanel.primaryphone, data.hiddenPhoneNumber);

    updateFormDisplayTextFieldValue(reviewPanel.savingsCardRXId, data.hiddenrxIdentifier);
    updateFormDisplayTextFieldValue(reviewPanel.reviewrxBIN, data.hiddenRxBIN);
    updateFormDisplayTextFieldValue(reviewPanel.reviewrxGroup, data.hiddenRxGroup);
    updateFormDisplayTextFieldValue(reviewPanel.reviewrxPCN, data.hiddenRxPCN);
    updateFormDisplayTextFieldValue(reviewPanel.ClaimAmount, data.amountPaidHidden);

    var distributionVal = panelObj.claimsDetailsPanel.distributionDetailsPanel.distribution;
    var gastroPanel = panelObj.claimsDetailsPanel.claimsPanel.gastroClaims;
    var editPanel = distributionVal.checkByMailDetails.personalDetailsPanel.editablePanel;
    var hiddenPerDetailPanel = reviewPanel.hiddenProfileDetailsSection;
    var textPanel = reviewPanel.completeRebateTextMessagePanel.optinOptions;
    var hiddenSavingCardPanel = reviewPanel.hiddenClaimsSection.hiddenSavingsCardSection;
    var hiddenCampaignPanel = reviewPanel.hiddenClaimsSection.campaingQuestionPanel;

    /* ---------------- Distribution ---------------- */
    globals.functions.setProperty(distributionVal.distributionMethodPanel.distributionMethod,{ value: data.distributionMethod });

    /* ---------------- Medication / Campaign ---------------- */
    globals.functions.setProperty(hiddenCampaignPanel.QuestionAnswer1,{ value: data.medicationBill });
    globals.functions.setProperty(gastroPanel.medicationBill,{ value: data.medicationBill });
    globals.functions.setProperty(panelObj.claimsDetailsPanel.claimsPanel.amountPaidHidden,{ value: data.amountPaidHidden });
    globals.functions.setProperty(panelObj.claimsDetailsPanel.claimsPanel.nonGastroClaims.amountPaid,{ value: data.amountPaidHidden });

    /* ---------------- Savings Card Hidden Fields ---------------- */
    globals.functions.setProperty(hiddenSavingCardPanel.hiddenRxBIN,{ value: data.hiddenRxBIN });
    globals.functions.setProperty(hiddenSavingCardPanel.hiddenrxIdentifier,{ value: data.hiddenrxIdentifier });
    globals.functions.setProperty(hiddenSavingCardPanel.hiddenRxPCN,{ value: data.hiddenRxPCN });
    globals.functions.setProperty(hiddenSavingCardPanel.hiddenRxGroup,{ value: data.hiddenRxGroup });

    /* ---------------- Editable Personal Details ---------------- */
    globals.functions.setProperty(editPanel.firstName,{ value: data.firstName });
    globals.functions.setProperty(editPanel.lastName,{ value: data.lastName });
    globals.functions.setProperty(editPanel.addresspanel.streetAddress,{ value: data.streetAddress });
    globals.functions.setProperty(editPanel.addresspanel.streetAddress2,{ value: data.streetAddress2 });
    globals.functions.setProperty(editPanel.addresspanel.city,{ value: data.city });
    globals.functions.setProperty(editPanel.addresspanel.stateDropdown,{ value: data.stateDropDown });
    globals.functions.setProperty(editPanel.addresspanel.editZipcode,{ value: data.editZipcode });

    /* ---------------- Hidden Profile ---------------- */
    globals.functions.setProperty(hiddenPerDetailPanel.hiddenPhoneNumber,{ value: data.hiddenPhoneNumber });
    globals.functions.setProperty(hiddenPerDetailPanel.hiddenDOB,{ value: data.hiddenDOB });
    globals.functions.setProperty(hiddenPerDetailPanel.hiddenMarkOptInFlag,{ value: data.MarketingOptIn });
    globals.functions.setProperty(hiddenPerDetailPanel.hiddenSMSOptInFlag,{ value: data.SMSMMSOptIn });
    globals.functions.setProperty(panelObj.updateProfileFlag,{ value: data.updateProfileFlag });

    /* ---------------- Text Message Panel ---------------- */
    globals.functions.setProperty(textPanel.phoneFormatted,{ value: data.phoneFormatted });
    globals.functions.setProperty(textPanel.amountFormatted,{ value: data.amountPaidHidden });
}

/**
 * Populates Adaptive Form file upload fields using decrypted claim image data.
 *
 * @param {String} rawData  JSON string containing decrypted image data
 * @param {Object} panelObj Root panel reference
 * @param {scope} globals
 */
function prefillImageDetails(rawData, panelObj, globals) {
    var data = JSON.parse(rawData);

    var claimPanel = panelObj.claimsDetailsPanel.claimsPanel;
    var gastroPanel = claimPanel.gastroClaims;

    /* ---------------- Treatment Upload ---------------- */
    var gastroTreatPanel = gastroPanel.treatmentUploadPanel.hiddenTreatmentFileUpload;
    var treatmentFileName = normalizeFileExtension(data.treatmentfileName);
    globals.functions.setProperty(gastroTreatPanel.treatmentfileName,{ value: treatmentFileName });
    globals.functions.setProperty(gastroTreatPanel.treatmentfileContent,{ value: data.treatmentfileContent });

    /* ---------------- EOB Upload ---------------- */
    var gastroEOBPanel = gastroPanel.explanationOfBenefitsPanel.hiddenEOBUploadPanel;
    var eobFileName = normalizeFileExtension(data.eobfileName);
    globals.functions.setProperty(gastroEOBPanel.eobfileName,{ value: eobFileName });
    globals.functions.setProperty(gastroEOBPanel.eobfileContent,{ value: data.eobfileContent });

    /* ---------------- Additional Upload ---------------- */
    var gastroAddPanel = gastroPanel.explanationOfBenefitsPanel.hiddenAdditionalFileUpload;
    var additionalFileName = normalizeFileExtension(data.additionalfileName);
    globals.functions.setProperty(gastroAddPanel.additionalfileName,{ value: additionalFileName });
    globals.functions.setProperty(gastroAddPanel.additionalfileContent,{ value: data.additionalfileContent });

    /* ---------------- Amount Paid Upload ---------------- */
    var amountPaidPanel = claimPanel.amountPaidUploadSection.hiddenPaymentFileUpload;
    var paymentFileName = normalizeFileExtension(data.paymentfileName);

    globals.functions.setProperty(amountPaidPanel.paymentfileName,{ value: paymentFileName });
    globals.functions.setProperty(amountPaidPanel.paymentfileContent,{ value: data.paymentfileContent });

    /* ---------------- Non-Gastro Medication Upload ---------------- */
    var medicationPanel = claimPanel.nonGastroClaims.medicationUploadPanel.hiddenMedicationFileUpload;
    var medicationFileName = normalizeFileExtension(data.medicationfileName);

    globals.functions.setProperty(medicationPanel.medicationfileName,{ value: medicationFileName });
    globals.functions.setProperty(medicationPanel.medicationfileContent,{ value: data.medicationfileContent });
}

/**
 * Normalizes file extension to lowercase.
 *
 * @param {string} fileName - Original filename
 * @returns {string} Filename with lowercase extension
 */
function normalizeFileExtension(fileName) {
    if (!fileName || typeof fileName !== 'string') {
        return '';
    }

    var updatedFileName = fileName.trim();
    var lastDotIndex = updatedFileName.lastIndexOf('.');

    if (lastDotIndex <= 0 || lastDotIndex === updatedFileName.length - 1) {
        return updatedFileName;
    }

    return updatedFileName.substring(0, lastDotIndex) + '.' + updatedFileName.substring(lastDotIndex + 1).toLowerCase();
}

/*
 * Sets savings card details in form
 *
 * @param {Array} savingsCardObj
 * @param {Object} savingCards
 * @param {Object} globals
 */
function setSavingsCardDetails(savingsCardObj, savingCards, globals) {
    if (!Array.isArray(savingsCardObj) || !savingCards) {
        return;
    }

    var uniqueMap = {};
    var uniqueCards = [];

    /* Remove duplicate rxId */
    for (var i = 0; i < savingsCardObj.length; i++) {
        var card = savingsCardObj[i];
        if (card && card.rxId && !uniqueMap[card.rxId]) {
            uniqueMap[card.rxId] = true;
            uniqueCards.push(card);
        }
    }

    var items = [];
    var enums = [];
    var enumNames = [];

    for (var j = 0; j < uniqueCards.length; j++) {
        var rxId = uniqueCards[j].rxId;
        items.push({text: rxId,value: rxId});
        enums.push(rxId);
        enumNames.push(rxId);
    }

    globals.functions.setProperty(savingCards, {visible: true});

    /* Override authored radio options */
    globals.functions.setProperty(savingCards, {items: items});
    globals.functions.setProperty(savingCards, {enum: enums});
    globals.functions.setProperty(savingCards, {enumNames: enumNames});

    /* Re-bind listener after DOM render */
    setTimeout(function () {
        savingCardsListener();
    },50);
}

/**
 * Handles SavingsCard selection
 * @param {scope} globals
 */
function savingCardsListener() {
    var container = document.querySelector('.savingCards');
    if (!container) return;

    // prevent duplicate binding
    if (container.dataset.listenerAttached === "true") return;
    container.dataset.listenerAttached = "true";

    container.addEventListener('change', function (e) {
         // Only handle real radio interaction
        if (!e.target || e.target.type !== "radio") return;
            container.classList.remove('custom-error');

            var errorDiv = container.querySelector('.cmp-adaptiveform-radiobutton__errormessage');
            if (errorDiv) {
                errorDiv.innerText = "";
            }
    });
}

/**
 * Validates currency format
 * @param {object} currentComponent
 ** @param {scope} globals
 * @returns {string}
 */
function validateCurrency(currentComponent) {
    if (!currentComponent || !currentComponent.$value) {
        return "false";
    }

    var value = currentComponent.$value.trim();
    if (!baseCurrencyCheck(value)) {
        return "false";
    }

    var numeric = parseFloat(value.replace(/[$,]/g, ''));
    if (isNaN(numeric) || numeric <= 0 || numeric > 50000) {
        return "false";
    }
    return "true";
}

/**
 * Validates currency format
 * @param {scope} globals
 * @param {string} amount
 * @returns {boolean}
 */
function baseCurrencyCheck(amount) {
    if (!amount || typeof amount !== "string") {
        return false;
    }
    var currencyCheck = /^\$?\d{1,3}(,?\d)*(\.\d{2})?$/;
    return currencyCheck.test(amount.trim());
}

/**
 * Removes $ and commas from a currency field value
 *
 * @param {object} sourceComponent
 * @returns {string}
 */
function commitAmountPaid(sourceComponent) {
    if (!sourceComponent || !sourceComponent.$value) {
        return "";
    }
    return sourceComponent.$value.replace(/[$,]/g, '');
}

/**
 * Formats currency by class
 * @param {Object} component
 * @param {String} targetClass
 * @param {scope} globals
 */
function baseFormatCurrencyByClass(component,targetClass,globals) {
    var currency = document.querySelector('.' + targetClass + ' input');
    if (!currency) return;

    // On focus - remove formatting
    currency.addEventListener("focus", function () {
        let value = this.value;
        if (!value) return;

        let raw = value.replace(/[$,]/g, '');
        if (raw.endsWith('.00')) {
            raw = raw.slice(0, -3);
        }
        this.value = raw;
    });

    // On input - allow everything
    currency.addEventListener("input", function () {});

    // On blur - format ONLY if valid number
    currency.addEventListener("focusout", function () {
        let value = this.value;
        if (!value) return;

        if (isNaN(value)) {
            return;
        }
        let number = parseFloat(value);
        // Format for display
        let formatted = number.toFixed(2);
        let parts = formatted.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        this.value = '$' + parts.join('.');

        // Set clean numeric value (no commas, no .00)
        globals.functions.setProperty(component,{value: number});
    });
}

/**
 *
 * @param {object} savingCards
 * @param {object} hiddenSavingsCardSection
 * @param {object} reviewPanel
 * @param {scope} globals
 */
function setHiddenSavingsCard(savingCards, hiddenSavingsCardSection, reviewPanel, globals) {
    if (!savingCards || !savingCards.$value || !hiddenSavingsCardSection) {
        return;
    }

    var selectedRxId = savingCards.$value;
    if (!selectedRxId) {
        return;
    }
    /* Set hidden rxIdentifier */
    globals.functions.setProperty(hiddenSavingsCardSection.hiddenrxIdentifier,{ value: selectedRxId });

    var requestDetails = getDecryptedvalue('admp_cr_ng_profile');
    if (!requestDetails || !requestDetails.SavingsCards) {
        return;
    }

    var savingsCardObject = requestDetails.SavingsCards;
    for (var i = 0; i < savingsCardObject.length; i++) {
        var card = savingsCardObject[i];
        if (card && card.rxId === selectedRxId) {
            /* Update Review Panel */
            updateFormDisplayTextFieldValue(reviewPanel.savingsCardRXId, selectedRxId); //Update review RX ID
            updateFormDisplayTextFieldValue(reviewPanel.reviewrxBIN, card.rxBin);
            updateFormDisplayTextFieldValue(reviewPanel.reviewrxGroup, card.groupNumber);
            updateFormDisplayTextFieldValue(reviewPanel.reviewrxPCN, card.rxPcn);

            /* Set Hidden Fields */
            globals.functions.setProperty(hiddenSavingsCardSection.hiddenRxPCN,{ value: card.rxPcn || "" });
            globals.functions.setProperty(hiddenSavingsCardSection.hiddenRxGroup,{ value: card.groupNumber || "" });
            globals.functions.setProperty(hiddenSavingsCardSection.hiddenRxBIN,{ value: card.rxBin || "" });
        }
    }
}

/**
 * Handles distribution method radio change
 *
 * @param {object} distributionMethod
 * @param {object} QuestionAnswer2
 * @param {object} checkByMailDetails
 * @param {object} nextNavButton
 * @param {object} directDepositPanel
 * @param {object} gastroDistribution
 * @param {scope} globals
 */
function handleIndicationChange(distributionMethod,QuestionAnswer2,checkByMailDetails,nextNavButton,directDepositPanel,gastroDistribution,globals) {
    if (!distributionMethod || !distributionMethod.$value) {
        return;
    }

    var selectedValue = distributionMethod.$value;
    if (selectedValue === "3935CFCE-C486-4D19-BB75-E52841C59207") {
        globals.functions.setProperty(QuestionAnswer2, {value: selectedValue});
        globals.functions.setProperty(checkByMailDetails, {visible: false});
        globals.functions.setProperty(nextNavButton, {visible: false});
        globals.functions.setProperty(directDepositPanel, {visible: true});
        globals.functions.setProperty(gastroDistribution, {visible: false});

        var result = baseUrlGetParam('result');
        if (result === 'true') {
            globals.functions.setProperty(nextNavButton, {visible: true});
        }
    }
}

/**
 * Generic text field validator wrapper
 *
 * @param {object} component
 * @param {scope} globals
 * @returns {string}
 */
function validateTextField(component,globals) {
    if (!component) {
        return "false";
    }

    var value = (component.$value || "").trim();
    if (!value) {
        return "false";
    }
    var fieldName = component.$name;

    var isValid = false;
    switch (fieldName) {
        case "firstName":
            isValid = baseValidateFirstName(value);
            break;
        case "lastName":
            isValid = baseValidateLastName(value);
            break;
        case "city":
            isValid = baseValidateCity(value);
            break;
        case "streetAddress":
            isValid = baseValidateAddress(value);
            break;
        case "streetAddress2":
            isValid = baseValidateAddress(value);
            break;
        case "editZipcode":
            isValid = baseValidateZipcode(value);
            break;
        default:
            isValid = false;
    }
    return isValid ? "true" : "false";
}

/**
 * Updates review HTML elements based on source component
 *
 * @param {object} sourceComponent
 * @param {scope} globals
 */
function updateReviewHtml(sourceComponent, globals) {
    if (!sourceComponent) {
        return;
    }
    var value = sourceComponent.$value;
    var fieldName = sourceComponent.$name;

    var fieldClassMap = {
        firstName: "fname",
        lastName: "lname",
        streetAddress: "reviewstreetaddress",
        streetAddress2: "streetaddress2",
        city: "reviewcity",
        stateDropdown: "reviewstate",
        editZipcode: "revzipcode",
        amountFormatted:"ClaimAmount",
        gastroMedicationAmount: "ClaimAmount",
        amountPaid:"ClaimAmount",
        amountPaidHidden:"ClaimAmount",
        savingCards: "savingsCardRXId"
    };

    var targetClass = fieldClassMap[fieldName];
    if (!targetClass) {
        return;
    }

    var elements = document.querySelectorAll("." + targetClass);
    for (var i = 0; i < elements.length; i++) {
          if(targetClass ==="ClaimAmount"){
             if(value){
                 value = "$"+value;
             }
          }
          elements[i].textContent = value;
    }
}

/**
 * Restrict ZIP code to numeric characters only
 *
 * @param {object} editZipcode
 * @returns {string}
 */
function restrictZipcode(editZipcode) {
    if (!editZipcode || !editZipcode.$value) {
        return "";
    }

    return editZipcode.$value.replace(/[^0-9]/g, '');
}

/**
 * handler for Transcard button
 * @param {object} guideRootPanel
 * @param {scope} globals
 */
function handleTranscardSubmit(guideRootPanel, globals) {
    if (!guideRootPanel || !guideRootPanel.claimsDetailsPanel) {
        console.log("Invalid rootPanel passed");
        return;
    }
    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);//trigger analytics

    /* -------- Modal initialization -------- */
    modalOpen();

    var cancelBtn = document.querySelector(".abbv-qPoll #cancelBtn");
    var okBtn = document.querySelector(".abbv-qPoll #okBtn");

    /* -------- Cancel Button -------- */
    if (cancelBtn) {
        cancelBtn.onclick = function () {
            modalClose();

            // Hide Continue button
            globals.functions.setProperty(guideRootPanel.claimsDetailsPanel.distributionDetailsPanel.toolbarPanel.distributionNextNavButton, { visible: false });
        };
    }

    /* -------- OK Button -------- */
    if (okBtn) {
        okBtn.onclick = function () {
            // Disable OK button
            okBtn.disabled = true;

            /* Prepare form + image payload */
            prepareFormSubmission(guideRootPanel);
            prepareImageSubmission(guideRootPanel);

            /* Call Transcard URL */
            baseGetTranscardURL();
        };
    }
}

function prepareFormSubmission(root) {
    var claimsPanel = root.claimsDetailsPanel.claimsPanel;
    var distributionPanel = root.claimsDetailsPanel.distributionDetailsPanel.distribution;
    var reviewPanel = root.claimsDetailsPanel.reviewPanel;
    var gastro = claimsPanel.gastroClaims;
    var nonGastro = claimsPanel.nonGastroClaims;

    var amount = "";
    if (nonGastro.amountPaid && nonGastro.amountPaid.$value) {
        amount = claimsPanel.amountPaidHidden.$value;
    } else if (gastro.gastroMedicationAmount && gastro.gastroMedicationAmount.$value) {
        amount = claimsPanel.amountPaidHidden.$value;
    }
	function getFieldValue(field) {
	    return field ? field.$value : "";
	}

    var formSubmission = {
        medicationBill: gastro.medicationBill.$value,
        gastroMedicationAmount: gastro.gastroMedicationAmount.$value,
        amountPaidUploadSection: claimsPanel.amountPaidUploadSection.$value,
        treatmentFile: gastro.treatmentUploadPanel.treatmentFile.$value,
        uploadEOB: gastro.explanationOfBenefitsPanel.uploadEOB.$value,
        additionalFileUpload: gastro.explanationOfBenefitsPanel.additionalFileUpload.$value,
        amountPaid: amount,
        uploadMedicationBill: nonGastro.medicationUploadPanel.uploadMedicationBill.$value,
        amountPaidHidden: claimsPanel.amountPaidHidden.$value,
        savingCards: claimsPanel.savingsCardDetailsPanel.$value,
        distributionMethod: distributionPanel.distributionMethodPanel.distributionMethod.$value,
        username: distributionPanel.checkByMailDetails.personalDetailsPanel.reviewPanel.username.$value,
        address: distributionPanel.checkByMailDetails.personalDetailsPanel.reviewPanel.address.$value,
        viewcity: distributionPanel.checkByMailDetails.personalDetailsPanel.reviewPanel.viewcity.$value,
        viewzipcode: distributionPanel.checkByMailDetails.personalDetailsPanel.reviewPanel.viewzipcode.$value,
        firstName: distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.firstName.$value,
        lastName: distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.lastName.$value,
        DateofBirth: getFieldValue(distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.dateofBirth),
        Gender: getFieldValue(distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.sex),
        GenderIdentity: getFieldValue(distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.genderIdentity),
        streetAddress: distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.addresspanel.streetAddress.$value,
        streetAddress2: distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.addresspanel.streetAddress2.$value,
        city: distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.addresspanel.city.$value,
        stateDropDown: distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.addresspanel.stateDropdown.$value,
        editZipcode: distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.addresspanel.editZipcode.$value,
        hiddenrxIdentifier: reviewPanel.hiddenClaimsSection.hiddenSavingsCardSection.hiddenrxIdentifier.$value,
        hiddenRxPCN: reviewPanel.hiddenClaimsSection.hiddenSavingsCardSection.hiddenRxPCN.$value,
        hiddenRxGroup: reviewPanel.hiddenClaimsSection.hiddenSavingsCardSection.hiddenRxGroup.$value,
        hiddenRxBIN: reviewPanel.hiddenClaimsSection.hiddenSavingsCardSection.hiddenRxBIN.$value,
        hiddenPhoneNumber: reviewPanel.hiddenProfileDetailsSection.hiddenPhoneNumber.$value,
        hiddenDOB: reviewPanel.hiddenProfileDetailsSection.hiddenDOB.$value,
        hiddenMarkOptInFlag: reviewPanel.hiddenProfileDetailsSection.hiddenMarkOptInFlag.$value,
        hiddenSMSOptInFlag: reviewPanel.hiddenProfileDetailsSection.hiddenSMSOptInFlag.$value,
        updateProfileFlag: root.updateProfileFlag.$value,
        phoneFormatted: reviewPanel.completeRebateTextMessagePanel.optinOptions.phoneFormatted.$value
    };

    var encryptReq = window.sjcl.encrypt('', JSON.stringify(formSubmission));
    sessionStorage.setItem('admp_patientFormSubmission', encryptReq);
	
	var editPanel = distributionPanel.checkByMailDetails.personalDetailsPanel.editablePanel.pediatricPatientDetail;
	if (root.hiddenPEDFlag && root.hiddenPEDFlag.$value && root.hiddenPEDFlag.$value === 'true' && editPanel) {
	    var formPEDSubmission = {
	        childNextTreatmentDate: editPanel.childNextTreatmentDate.$value,
	        childFirstName: editPanel.childFirstName.$value,
	        childLastName: editPanel.childLastName.$value,
	        childSex: editPanel.childSex.$value,
	        childDOB: editPanel.childDOB.$value
	    };
	    var encryptPEDReq = window.sjcl.encrypt('', JSON.stringify(formPEDSubmission));
	    sessionStorage.setItem('admp_PEDFormDetails', encryptPEDReq);
	}
}

async function prepareImageSubmission(root) {
    var claimsPanel = root.claimsDetailsPanel.claimsPanel;
    var gastro = claimsPanel.gastroClaims;
    var nonGastro = claimsPanel.nonGastroClaims;

    var imagVal = {
        treatmentfileName: gastro.treatmentUploadPanel.hiddenTreatmentFileUpload.treatmentfileName.$value,
        treatmentfileContent:gastro.treatmentUploadPanel.hiddenTreatmentFileUpload.treatmentfileContent.$value,
        eobfileName: gastro.explanationOfBenefitsPanel.hiddenEOBUploadPanel.eobfileName.$value,
        eobfileContent:gastro.explanationOfBenefitsPanel.hiddenEOBUploadPanel.eobfileContent.$value,
        additionalfileName: gastro.explanationOfBenefitsPanel.hiddenAdditionalFileUpload.additionalfileName.$value,
        additionalfileContent: gastro.explanationOfBenefitsPanel.hiddenAdditionalFileUpload.additionalfileContent.$value,
        paymentfileName: claimsPanel.amountPaidUploadSection.hiddenPaymentFileUpload.paymentfileName.$value,
        paymentfileContent: claimsPanel.amountPaidUploadSection.hiddenPaymentFileUpload.paymentfileContent.$value,
        medicationfileName: nonGastro.medicationUploadPanel.hiddenMedicationFileUpload.medicationfileName.$value,
        medicationfileContent: nonGastro.medicationUploadPanel.hiddenMedicationFileUpload.medicationfileContent.$value
    };

    var encryptReq = window.sjcl.encrypt('', JSON.stringify(imagVal));
    await setAdmpStorageItem('admp_imagVal', encryptReq);
}

/**
 * Opens (or creates) the IndexedDB used for admp form data storage.
 * @returns {Promise<IDBDatabase>}
 */
function openAdmpStorageDB() {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open('admpStorage', 1);
        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains('formData')) {
                db.createObjectStore('formData');
            }
        };
        request.onsuccess = function(event) { resolve(event.target.result); };
        request.onerror = function(event) { reject(event.target.error); };
    });
}

/**
 * Saves a value for the given key into the admpStorage IndexedDB.
 * @param {string} key
 * @param {string} value
 * @returns {Promise<void>}
 */
async function setAdmpStorageItem(key, value) {
    return openAdmpStorageDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('formData', 'readwrite');
            var store = tx.objectStore('formData');
            var req = store.put(value, key);
            req.onsuccess = function() { resolve(); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    });
}

/**
 * Retrieves the value for the given key from the admpStorage IndexedDB.
 * @param {string} key
 * @returns {Promise<string|undefined>}
 */
async function getAdmpStorageItem(key) {
    return openAdmpStorageDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('formData', 'readonly');
            var store = tx.objectStore('formData');
            var req = store.get(key);
            req.onsuccess = function(e) { resolve(e.target.result); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    });
}

/**
 * Deletes the value for the given key from the admpStorage IndexedDB.
 * @param {string} key
 * @returns {Promise<void>}
 */
async function removeAdmpStorageItem(key) {
    return openAdmpStorageDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('formData', 'readwrite');
            var store = tx.objectStore('formData');
            var req = store.delete(key);
            req.onsuccess = function() { resolve(); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    });
}

/**
 * Sync checkbox group based on individual checkboxes
 *
 * @param {object} receiveEmails
 * @param {object} receiveTextMessage
 * @param {object} sampleCheck
 * @param {scope} globals
 */
function syncSampleCheckGroup(receiveEmails, receiveTextMessage, sampleCheck,globals) {
    if (!sampleCheck) {
        return;
    }

    var selectedValues = [];
    if (receiveEmails && receiveEmails.$value === true) {
        selectedValues.push("email");
    }
    if (receiveTextMessage && receiveTextMessage.$value === true) {
        selectedValues.push("text");
    }

    sampleCheck.$value = selectedValues;
}

/**
 * Format phone on initialize
 *
 * @param {object} component
 * @param {scope} globals
 * @returns {string}
 */
function formatPhoneOnInit(component,globals) {
    if (!component || !component.$value) {
        return "";
    }

    var digits = component.$value.replace(/\D/g, '');
    if (digits.length !== 10) {
        return component.$value;
    }
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}

/**
 * Validate PhoneNumber
 *
 * @param {object} Phone
 * @param {scope} globals
 * @returns {boolean}
 */
function validatePhoneNumber(phone,globals) {
    if (!phone || !phone.$value) {
        return false;
    }
    var phoneNumberExp = /^([0-1]\s{1})?[2-9]{1}[0-9]{2}[-]\d{3}[-]\d{4}$|^([2-9]{1})(\d{9})$/;
    return phoneNumberExp.test(phone.$value) ? true : false;
}

/**
 * Returns formatted current date based on format key
 * @param {string} formatKey
 * @param {scope} globals
 * @returns {string}
 */
function setCurrentDateTimeField(formatKey) {
    var date = new Date();

    switch (formatKey) {
        case "UTC":
            return date.toUTCString();
        case "ISO":
            return date.toISOString();
        case "T-format":
            return date.getFullYear() + "-" +
                ("0" + (date.getMonth() + 1)).slice(-2) + "-" +
                ("0" + date.getDate()).slice(-2) + "T" +
                ("0" + date.getHours()).slice(-2) + ":" +
                ("0" + date.getMinutes()).slice(-2) + ":" +
                ("0" + date.getSeconds()).slice(-2) + "+00:00";
        case "MM/DD/YYYY":
            return ("0" + (date.getMonth() + 1)).slice(-2) + "/" +
                ("0" + date.getDate()).slice(-2) + "/" +
                date.getFullYear();
        default:
            return "";
    }
}

/**
 * Handles Back button click
 * @param {scope} globals
 */
function handleBackNavigation(globals) {
    var currentButton = globals.event.target;
    if (!currentButton || !currentButton.$parent || !currentButton.$parent.$parent) {
        return;
    }

    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);//trigger analytics

    var guideRootPanel = currentButton.$parent.$parent.$parent.$parent;
    var parentPanel = currentButton.$parent.$parent;

    var wizard = guideRootPanel.claimsDetailsPanel;
    if (!wizard || !wizard.$activeChild) {
        globals.functions.setFocus(wizard.reviewPanel); //set focus to the reviewPanel
    }

    var result = baseUrlGetParam('result');
    if(wizard.$activeChild.$name === "reviewPanel" && result === 'true'){
        // Move to previous panel
        globals.functions.setFocus(wizard, 'previousItem');
        // Focus first field of the panel
        setTimeout(function () {
            globals.functions.setProperty(wizard.distributionDetailsPanel.toolbarPanel.distributionBackButton, {visible: false});
            focusFirstFieldOfPanel(wizard.$activeChild, globals);
        }, 50);
        return;
    }

    // Move to previous panel
    globals.functions.setFocus(wizard, 'previousItem');

    // Focus first field of the panel
    setTimeout(function () {
        focusFirstFieldOfPanel(wizard.$activeChild, globals);
    }, 50);
}

function focusFirstFieldOfPanel(panel, globals) {
    if (!panel || !panel.$children || panel.$children.length === 0) {
        return;
    }

    // Pick first visible field
    for (var i = 0; i < panel.$children.length; i++) {
        var child = panel.$children[i];

        if (child && child.visible !== false) {
            globals.functions.setFocus(child);
            return;
        }
    }
}

/**
 * Handles Next button click in wizard
 * @param {scope} globals
 */
function handleNextNavigation(globals) {
    var button = globals.event.target;
    if (!button || !button.$parent || !button.$parent.$parent) return;

    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);//trigger analytics

    var guideRootPanel = button.$parent.$parent.$parent.$parent;

    var wizard = guideRootPanel.claimsDetailsPanel;
    if (!wizard) return;
    if (!wizard.$activeChild) {
        globals.functions.setFocus(wizard.claimsPanel);
    }

    var activePanel = wizard.$activeChild || wizard.claimsPanel;
    if (!activePanel) return;

    // AEM validation
    var validations = globals.functions.validate(activePanel);
    var panelName = activePanel.$name;

    // Custom radio validation
    var isSelected = true;
    var container = null;
    if (panelName === "claimsPanel") {
        container = document.querySelector('.savingCards');
        if (container) {
            isSelected = false;
            var radios = container.querySelectorAll('input[type="radio"]');
            for (var i = 0; i < radios.length; i++) {
                if (radios[i].checked) {
                    isSelected = true;
                    break;
                }
            }
        }
    }

    // Combine validation result
    var hasErrors = (validations && validations.length > 0) || !isSelected;
    if (hasErrors) {
        // Custom radio error
        if (!isSelected && panelName === "claimsPanel" && container) {
            container.classList.add('custom-error');
            var message = "Please make a selection.";
            var errorDiv = container.querySelector('.cmp-adaptiveform-radiobutton__errormessage');
            if (errorDiv) {
                errorDiv.innerText = message;
            }
        }
        return; // STOP navigation
    }

    // Clear radio error
    if (panelName === "claimsPanel" && container) {
        container.classList.remove('custom-error');
        var errorDiv = container.querySelector('.cmp-adaptiveform-radiobutton__errormessage');
        if (errorDiv) {
           errorDiv.innerText = "";
        }
    }

    // Move to next panel
    globals.functions.setFocus(wizard, 'nextItem');
    var nextPanel = wizard.$activeChild;
    if (nextPanel) {
        focusFirstFieldOfPanel(nextPanel, globals);
        // Re-apply distribution logic after navigation
        if (nextPanel.$name === "distributionDetailsPanel") {
            var distributionMethod = wizard.distributionDetailsPanel.distribution.distributionMethodPanel.distributionMethod;
            var nextNavButton = wizard.distributionDetailsPanel.toolbarPanel.distributionNextNavButton;
            var selectedValue = distributionMethod.$value;
            if (selectedValue === "3935CFCE-C486-4D19-BB75-E52841C59207") {
                // Delay to wait for AEM render cycle
                setTimeout(function () {
                    globals.functions.setProperty(nextNavButton, { visible: false });
                }, 50);
            }
        }
    }
}

/**
 * Handles conditional visibility logic on Next
 *
 * @param {scope} globals
 */
function handleNextConditionalLogic(globals) {
    var button = globals.event.target;
    if (!button || !button.$parent || !button.$parent.$parent) {
        return;
    }

    var guideRootPanel = button.$parent.$parent.$parent.$parent;
    var wizard = guideRootPanel.claimsDetailsPanel;
    if (!wizard || !wizard.$activeChild) {
        return;
    }

    var panelName = wizard.$activeChild.$name;
    if (panelName === "reviewPanel") {
        var reviewPanel = wizard.reviewPanel;
        var claimsPanel = wizard.claimsPanel;

        /* ---------------- Claim Amount Logic ---------------- */
        var amountFormatted = reviewPanel.completeRebateTextMessagePanel.optinOptions.amountFormatted;
        var gastroMedicationAmount = claimsPanel.gastroClaims.gastroMedicationAmount;
        var amountPaid = claimsPanel.nonGastroClaims.amountPaid;
        var amountPaidHidden = claimsPanel.amountPaidHidden;
        var medicationBillValue= claimsPanel.gastroClaims.medicationBill.$value;

        if (amountFormatted && amountFormatted.$value && medicationBillValue == "83334BF4-039D-4DC4-805A-045AB7D399C7") {
            updateFormDisplayTextFieldValue(reviewPanel.ClaimAmount, formatWithTwoDecimals(amountPaidHidden));
        }
        else if (gastroMedicationAmount && gastroMedicationAmount.$value && medicationBillValue == "83334BF4-039D-4DC4-805A-045AB7D399C7") {
            updateFormDisplayTextFieldValue(reviewPanel.ClaimAmount, formatWithTwoDecimals(amountPaidHidden));
        }
        else if (amountPaid && amountPaid.$value) {
            updateFormDisplayTextFieldValue(reviewPanel.ClaimAmount, formatWithTwoDecimals(amountPaidHidden));
        }
    }
}

function formatWithTwoDecimals(value) {
    let num = parseFloat(value);
    if (isNaN(num)) return '';

    let formatted = num.toFixed(2);
    let parts = formatted.split('.');

    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + parts.join('.');
}

/**
 * Handles Submit Button Click
 * @param {scope} globals
 */
function handleClaimsSubmit(globals) {
    var button = globals.event.target;
    if (!button || !button.$parent || !button.$parent.$parent) {
        return;
    }

    setCorrelationIdCookie();

    var guideRootPanel = button.$parent.$parent.$parent.$parent;
    var wizard = guideRootPanel.claimsDetailsPanel;
    if (!wizard) {
        return;
    }

    /* --------- Get medicationBill value  ----------------- */
    guideBridge.getFormDataObject({
        success: function(resultObj) {
            var formJson = JSON.parse(resultObj.data.data);
            var medicationBillValue = formJson.medicationBill;

            /* ----- Export formData ----------- */
            var formData = globals.functions.exportData();
            formData.Claims.CreateClaims.Images = [];
            if (medicationBillValue) {
                setGastroImages(guideRootPanel, formData, medicationBillValue, globals);
            } else {
                setNonGastroImage(guideRootPanel, formData, globals);
            }

            /* ------ Validate --------- */
            const errors = globals.functions.validate();
            if (errors.length === 0 || (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes("recaptcha"))) {
                $(".custom-submit").prop("disabled", true);
                showLoader(true,"Submitting");
                fetchObservabilityAndSubmit(globals, formData);
            } else {
                console.warn("Please fill the empty fields");
            }
        }
    });
}

/**
 * Handles successful form submission
 *
 * @param {scope} globals
 */
function handleSubmitSuccess(globals) {
    let response = globals.event.payload.body;
    if (!response || !response.metadata || !response.metadata.FormSubmitInfo) {
        return;
    }

    $('.custom-submit').prop('disabled', true);// Disable submit button
    showLoader(true,"Submitting");

    let apiResponse = parseJavaMap(response.metadata.FormSubmitInfo);
    if (apiResponse && apiResponse.IsStatusSuccessful === "true") {
        /* ---------- Analytics ---------- */
        if (typeof analyticspayload !== "undefined" && analyticspayload.validPayload) {
            admp_analytics_functions.setFormStepName("submit");
            analyticspayload.getFormCompletePayload();
        } else if (typeof analyticsFormSubmitEvent === "function") {
            analyticsFormSubmitEvent();
        }

        /* ---------- Redirect ---------- */
            baseURLRedirection(window.abbviecloudforms.core.formProperties.registrationthankyoupageurl, globals);
    } else {
        $('.custom-submit').prop('disabled', false);
        showLoader(false);
        admp_analytics_functions.onFormSubmitError(apiResponse);
        baseHandleErrorResponse(apiResponse, globals);
    }
}

function parseJavaMap(str) {
    let obj = {};
    str.replace(/[{}]/g, '').split(',').forEach(pair => {
        let [key, value] = pair.split('=');
        obj[key.trim()] = value.trim();
    });
    return obj;
}


/**
 * Set Gastro Images
 * @param {Object} guideRootPanel
 * @param {Object} formData
 * @param {Object} medicationBill
 * @param {scope} globals
 */
function setGastroImages(guideRootPanel, formData,medicationBill, globals) {
    var claimsDetailsPanel = guideRootPanel.claimsDetailsPanel;
    var claimsPanel = claimsDetailsPanel.claimsPanel;
    var gastroClaims = claimsPanel.gastroClaims;

    if (medicationBill === "83334BF4-039D-4DC4-805A-045AB7D399C7") {
        var hiddenTreatmentFileUpload = gastroClaims.treatmentUploadPanel.hiddenTreatmentFileUpload;
        if (hiddenTreatmentFileUpload.treatmentfileContent.$value) {
            getImageInstance(hiddenTreatmentFileUpload.treatmentfileName,hiddenTreatmentFileUpload.treatmentfileContent,hiddenTreatmentFileUpload.treatmentattachmentType,formData);
        }

        var hiddenPaymentFileUpload = claimsPanel.amountPaidUploadSection.hiddenPaymentFileUpload;
        if (hiddenPaymentFileUpload.paymentfileContent.$value) {
            getImageInstance(hiddenPaymentFileUpload.paymentfileName,hiddenPaymentFileUpload.paymentfileContent,hiddenPaymentFileUpload.paymentattachmentType,formData);
        }
    }

    if (medicationBill === "4F797388-E9F8-49F4-A48D-9270C0A3B114") {
        var hiddenEOBUploadPanel = gastroClaims.explanationOfBenefitsPanel.hiddenEOBUploadPanel;
        if (hiddenEOBUploadPanel.eobfileContent.$value) {
            getImageInstance(hiddenEOBUploadPanel.eobfileName,hiddenEOBUploadPanel.eobfileContent,hiddenEOBUploadPanel.eobattachmentType,formData);
        }

        var hiddenAdditionalFileUpload = gastroClaims.explanationOfBenefitsPanel.hiddenAdditionalFileUpload;
        if (hiddenAdditionalFileUpload.additionalfileContent.$value) {
            getImageInstance(hiddenAdditionalFileUpload.additionalfileName,hiddenAdditionalFileUpload.additionalfileContent,hiddenAdditionalFileUpload.additionalattachmentType,formData);
        }
    }
}

/**
 * Set Non Gastro Images
 * @param {Object} guideRootPanel
 * @param {Object} formData
 * @param {scope} globals
 */
function setNonGastroImage(guideRootPanel, formData, globals) {
    var indicationCookieValue = baseGetCookieValue('admp_crindication');
    if (!(indicationCookieValue === '3' || indicationCookieValue === '6')) {
        return;
    }

    var claimsDetailsPanel = guideRootPanel.claimsDetailsPanel;
    var claimsPanel = claimsDetailsPanel.claimsPanel;
    var hiddenMedicationFileUpload = claimsPanel.nonGastroClaims.medicationUploadPanel.hiddenMedicationFileUpload;
    if (hiddenMedicationFileUpload.medicationfileContent.$value) {
        getImageInstance(hiddenMedicationFileUpload.medicationfileName,hiddenMedicationFileUpload.medicationfileContent,hiddenMedicationFileUpload.medicationattachmentType,formData);
    }

    var hiddenPaymentFileUpload = claimsPanel.amountPaidUploadSection.hiddenPaymentFileUpload;
    if (hiddenPaymentFileUpload.paymentfileContent.$value) {
        getImageInstance(hiddenPaymentFileUpload.paymentfileName,hiddenPaymentFileUpload.paymentfileContent,hiddenPaymentFileUpload.paymentattachmentType,formData);
    }
}

/**
  * Inserts image object into payload
  * @param {Object} fileName
  * @param {Object} fileContent
  * @param {Object} attachmentType
  * @param {Object} formData
  */
function getImageInstance(fileName, fileContent, attachmentType, formData) {
    if (!fileContent || !fileContent.$value) {
        return;
    }

    var imagesArray = formData.Claims.CreateClaims.Images;
    var newImage = {
        FileName: fileName.$value,
        FileContent: fileContent.$value,
        AttachmentType: attachmentType.$value
    };

    imagesArray.push(newImage);
}

/**
 * Initializes the header panel logic.
 *
 * This method:
 *  - Validates invalid entry redirection.
 *  - Checks the `admp_ufln` cookie.
 *  - Calls user profile API if cookie is missing or undefined.
 *
 * @param {Object} invalidRedirect - Object containing redirect configuration.
 * @param {Scope} globals - Global scope reference (if required for future use).
 */
function headerPanelInitialize(invalidRedirect, globals) {

    if (invalidEntry(invalidRedirect)) {

        var admpUfln = baseGetCookieValue('admp_ufln');

        if (!admpUfln || admpUfln === 'undefined') {
            baseGetUserProfile('fm-brandname-skyrizi', 'originNameWeb');
        }
    }
}

/**
 * setFileAttachPathToTextField
 * @name setFileAttachPathToTextField
 * @param {Object} fileUploadObj
 * @param {Object} saveButton
 * @param {Object} responseFileNames
 * @param {boolean} validationRequired
 * @param {Object} duplicateFileError
 * @param {scope} globals
 */
function setFileAttachPathToTextField(fileUploadObj, saveButton, responseFileNames, validationRequired, duplicateFileError, globals) {
    if (event.target.className === 'cmp-adaptiveform-fileinput__filedelete') {
            if (fileUploadObj) {
                globals.functions.setProperty(fileUploadObj, { value: null, validationState: "none", errorMessage: "" });
                }

    } else {
        if (!basValidateDuplicateNames(responseFileNames.$value, fileUploadObj.$value.name, validationRequired)) {
            if (saveButton) {
                globals.functions.setProperty(fileUploadObj, { validationState: "valid", errorMessage: "", valid: true });
                globals.functions.setProperty(saveButton, { visible: true }); // Show the save button if the file is attached
            }
        } else {
            globals.functions.setProperty(fileUploadObj, { validationState: "error", errorMessage: duplicateFileError.$value, valid: false });
            if (saveButton) {
                globals.functions.setProperty(saveButton, { visible: false }); // Hide the save button if the file is a duplicate
            }
        }
    }
}


function basValidateDuplicateNames(payloadFiles, fileName, validationRequired) {
    if (!validationRequired || !payloadFiles) {
        return false;
    }
    var trimmedArray = payloadFiles.split(',').map(function(value) {
        return value.trim();
    });
    return trimmedArray.includes(fileName);
}

/* Below function is to update the CR3 claim with an additional file upload. */
/**
 * Updates a CR3 claim by uploading an additional file attachment.
 *
 * This function retrieves the uploaded file from the Adaptive Form using
 * `guideBridge.getFormDataObject`, converts the file to Base64 format,
 * and sends it to the backend API through the AbbVie proxy endpoint.
 * After a successful upload, the UI is updated to show the uploaded
 * file message and hide the upload controls.
 *
 * @function baseUpdateClaimsWithAttachment
 * @param {Object} crAccountId - Claim account ID used to update the claim in the backend system.
 * @param {Object} fileAddedTextField - GuideBridge reference to the text field used to display upload confirmation.
 * @param {Object} fileUploadPanel - GuideBridge reference to the panel containing the file upload component.
 * @param {Object} saveButton - GuideBridge reference to the save button that triggers the upload.
 * @param {Scope} globals - Global object containing helper functions (e.g., setProperty, reset).
 *
 * @returns {void}
 */
function baseUpdateClaimsWithAttachment(crAccountId, fileAddedTextField, fileUploadPanel, saveButton, globals) {

    showLoader(true,"Submitting");
    var apiUrl = '/abbviecloud/bin/abbvie/apiproxy';
    var fileName = "";

    guideBridge.getFormDataObject({
        success: function(resultObj) {

            if (!resultObj || !resultObj.data || !resultObj.data.attachments) {
                console.warn("No attachments found");
                showLoader(false);
                return;
            }

            var attachments = resultObj.data.attachments;
            var matchedAttachment = attachments[0]; // assuming single file upload

            if (!matchedAttachment) {
                console.warn("No matching attachment");
                showLoader(false);
                return;
            }

            var file = matchedAttachment.data;
            fileName = normalizeFileExtension(matchedAttachment.name);

            /* ---------- CONVERT FILE TO BASE64 ---------- */
            var reader = new FileReader();

            reader.onload = function() {

                var base64 = reader.result.split(",")[1];

                /* ---------- REQUEST BODY ---------- */
                var requestBody = {
                    UpdateClaim: {
                        ClaimId: crAccountId.$value,
                        Images: [{
                            AttachmentType: "Other",
                            FileContent: base64,
                            FileName: fileName
                        }]
                    }
                };

                var proxyPayload = {
                    brandName: window.abbviecloudforms.core.formProperties.brandName,
                    actionType: window.abbviecloudforms.core.formProperties.apiType,
                    originName: baseDetectDeviceType(),
                    payload: JSON.stringify(requestBody),
                    requestType: 'POST',
                    version: 'V1',
                    formAction: 'UpdateClaims',
                    CRAccountId: crAccountId.$value
                };

                baseAjaxCall(
                    apiUrl,
                    'POST',
                    JSON.stringify(proxyPayload),
                    true,
                    onSuccess,
                    onFailure
                );
            };

            reader.readAsDataURL(file);
        }
    });

    function onSuccess(data) {

        showLoader(false);

        if (data.IsStatusSuccessful) {

            globals.functions.setProperty(fileAddedTextField, { visible: true });

            updateFormDisplayTextFieldValue( fileAddedTextField, fileName + " uploaded to your claim");

            globals.functions.setProperty(fileUploadPanel, { visible: false });
            globals.functions.setProperty(saveButton, { visible: false });

        } else {
            console.log(`Error :: ${data.ErrorResponseMessageList[0].ErrorCode} = ${data.ErrorResponseMessageList[0].ErrorMessage}`);
            baseHandleErrorResponse(data);
        }
    }

    function onFailure(error) {

        showLoader(false);
        console.error("Error in updating claim : ", error);

    }
}
function convertUTCDateToMMDDYYYY(utcDate) {
    var date = new Date(utcDate);
    if (!isNaN(date)) {
        var month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
        var day = ('0' + date.getUTCDate()).slice(-2);
        var year = date.getUTCFullYear();
        return month + '/' + day + '/' + year;
    } else {
        return utcDate;
    }
}

/**
 * Handles file upload validation
 *
 * @param {object} treatmentFile
 * @param {object} gastroTreatmentUpload
 * @param {object} treatmentfileName
 * @param {object} treatmentfileContent
 * @param {scope} globals
 */
function handleFileAttachment(treatmentFile, gastroTreatmentUpload, treatmentfileName, treatmentfileContent, globals) {
    if (!treatmentFile || !treatmentFile.$value) {
        return;
    }

    var isValid = validateLowercaseExtension(treatmentFile,treatmentfileName,treatmentfileContent,globals);
    if (!isValid) return;

    setImageFieldsForClaims("treatmentFile",gastroTreatmentUpload,treatmentfileName,treatmentfileContent,globals);
}

/**
 * Handles file upload validation
 *
 * @param {object} uploadEOB
 * @param {object} gastroEOBUploadPath
 * @param {object} eobfileName
 * @param {object} eobfileContent
 * @param {scope} globals
 */
function handleUploadEOB(uploadEOB, gastroEOBUploadPath, eobfileName, eobfileContent, globals) {
    if (!uploadEOB || !uploadEOB.$value) {
        return;
    }

    var isValid = validateLowercaseExtension(uploadEOB,eobfileName,eobfileContent,globals);
    if (!isValid) return;

    setImageFieldsForClaims("uploadEOB",gastroEOBUploadPath,eobfileName,eobfileContent,globals);
}

/**
 * Handles file upload validation
 *
 * @param {object} additionalFileUpload
 * @param {object} gastroAdditionalUploadPath
 * @param {object} additionalfileName
 * @param {object} additionalfileContent
 * @param {scope} globals
 */
function handleAdditionalFileUpload(additionalFileUpload, gastroAdditionalUploadPath, additionalfileName, additionalfileContent, globals) {
    if (!additionalFileUpload || !additionalFileUpload.$value) {
        return;
    }

    var isValid = validateLowercaseExtension(additionalFileUpload,additionalfileName,additionalfileContent,globals);
    if (!isValid) return;

    setImageFieldsForClaims("additionalFileUpload",gastroAdditionalUploadPath,additionalfileName,additionalfileContent,globals);
}

/**
 * Handles file upload validation
 *
 * @param {object} uploadMedicationBill
 * @param {object} nonGastroMedicationUploadPath
 * @param {object} medicationfileName
 * @param {object} medicationfileContent
 * @param {scope} globals
 */
function handleMedicationUpload(uploadMedicationBill, nonGastroMedicationUploadPath, medicationfileName, medicationfileContent, globals) {
    if (!uploadMedicationBill || !uploadMedicationBill.$value) {
        return;
    }

    var isValid = validateLowercaseExtension(uploadMedicationBill,medicationfileName,medicationfileContent,globals);
    if (!isValid) return;

    setImageFieldsForClaims("uploadMedicationBill",nonGastroMedicationUploadPath,medicationfileName,medicationfileContent,globals);
}

/**
 * Handles file upload validation
 *
 * @param {object} proofOfPayment
 * @param {object} paymentUploadPath
 * @param {object} paymentfileName
 * @param {object} paymentfileContent
 * @param {scope} globals
 */
function handleProofOfPaymentUpload(proofOfPayment, paymentUploadPath, paymentfileName, paymentfileContent, globals) {
     if (!proofOfPayment || !proofOfPayment.$value) {
        return;
    }

    var isValid = validateLowercaseExtension(proofOfPayment,paymentfileName,paymentfileContent,globals);
    if (!isValid) return;

    setImageFieldsForClaims("proofOfPayment",paymentUploadPath,paymentfileName,paymentfileContent,globals);
}

function validateLowercaseExtension(fileField, fileNameField, fileContentField, globals) {
    if (!fileField || !fileField.$value || !fileField.$value.name) {   // No file
         return false;
    }

    var fname = fileField.$value.name;
    var lastDot = fname.lastIndexOf('.');
    var originalExt = (lastDot === -1 || lastDot === fname.length - 1) ? '' : fname.substring(lastDot + 1);

    // INVALID (uppercase extension)
    if (originalExt !== originalExt.toLowerCase()) {
        // ALWAYS clear existing & new file
        globals.functions.reset(fileField);
        if (fileNameField) globals.functions.reset(fileNameField);
        if (fileContentField) globals.functions.reset(fileContentField);

        setTimeout(function () {
            globals.functions.validate(fileField);
        }, 50);
        return false;
    }
    return true;
}

/**
 * Uses GuideBridge API to retrieve uploaded attachments
 * @param {string} componentName
 * @param {object} fileTextBox
 * @param {object} fileName
 * @param {object} fileContent
 * @param {scope} globals
 */
function setImageFieldsForClaims(componentName, fileTextBox, fileName, fileContent, globals) {
    guideBridge.getFormDataObject({
        success: function(resultObj) {
            if (!resultObj || !resultObj.data || !resultObj.data.attachments) {
                console.warn("No attachments found");
                return;
            }

            var attachments = resultObj.data.attachments;
            var matchedAttachment = null;
            for (var i = 0; i < attachments.length; i++) {
                if (attachments[i].dataRef === componentName) {
                    matchedAttachment = attachments[i];
                    break;
                }
            }

            /* ---------- FILE REMOVED ---------- */
            if (!matchedAttachment) {
                globals.functions.reset(fileName);
                globals.functions.reset(fileContent);
                globals.functions.reset(fileTextBox);

                return;
            }

            /* ---------- SET FILE NAME ---------- */
            globals.functions.setProperty(fileName, {value: matchedAttachment.name});

            /* ---------- GET ACTUAL FILE OBJECT ---------- */
            var file = matchedAttachment.data;
            if (!file) {
                console.warn("File object missing");
                return;
            }

            /* ---------- CONVERT TO BASE64 ---------- */
            var reader = new FileReader();
            reader.onload = function () {
                var base64 = reader.result.split(",")[1];
                globals.functions.setProperty(fileContent, {value: base64});
            };
            reader.readAsDataURL(file);
        }
    });
}

/**
* baseNavigateToUrlFromSamedomainInSamePage
* @name baseNavigateToUrlFromSamedomainInSamePage
* @param {String} url
* @param {scope} globals
*/
function baseNavigateToUrlFromSamedomainInSamePage(url, globals) {
    if (!url) return;

    admp_analytics_functions.analyticsFormInteractionEvent(globals.event.target);//trigger analytics

    window.location.href = window.location.origin + url;
}

function updatePEDFieldsFromRequest(requestDetails, panelObj, globals) {

    if (!panelObj.claimsDetailsPanel.distributionDetailsPanel.distribution.checkByMailDetails.personalDetailsPanel.editablePanel ||
        !panelObj.claimsDetailsPanel.distributionDetailsPanel.distribution.checkByMailDetails.personalDetailsPanel.editablePanel.pediatricPatientDetail || !panelObj.claimsDetailsPanel.reviewPanel) {
        return;
    }

    var editPanel = panelObj.claimsDetailsPanel.distributionDetailsPanel.distribution
        .checkByMailDetails.personalDetailsPanel.editablePanel.pediatricPatientDetail;

    var reviewPanel = panelObj.claimsDetailsPanel.reviewPanel;

    var patient = requestDetails.PediatricPatient;

    function hideField(target) {
        if (!target) return;
        globals.functions.setProperty(target, { visible: false });
    }


    function setEditField(value, target) {
        if (!target) return;
        globals.functions.setProperty(target, { value: value || '' });
    }
    if (!patient) {  // Hide PED fields
        if (reviewPanel) {
            hideField(reviewPanel.reviewChildRecentTreatmentDate);
            hideField(reviewPanel.reviewChildFirstname);
            hideField(reviewPanel.reviewChildLastName);
            hideField(reviewPanel.reviewChildDOB);
            hideField(reviewPanel.reviewChildSex);
            hideField(reviewPanel.editPanel);
        }

        return;
    }
    if (panelObj.hiddenPEDFlag && patient) {
        globals.functions.setProperty(panelObj.hiddenPEDFlag, { value: true });
    }

    if (reviewPanel) { // Review fields
        setReviewField(requestDetails.DateofNextTreatment, reviewPanel.reviewChildRecentTreatmentDate, 'reviewChildRecentTreatmentDate', globals);
        setReviewField(patient.PatientFirstName, reviewPanel.reviewChildFirstname, 'reviewChildFirstname', globals);
        setReviewField(patient.PatientLastName, reviewPanel.reviewChildLastName, 'reviewChildLastName', globals);
        setReviewField(patient.PatientGender, reviewPanel.reviewChildSex, 'reviewChildSex', globals);
        setReviewField(patient.PatientDateOfBirth, reviewPanel.reviewChildDOB, 'reviewChildDOB', globals);
    }
    if (editPanel) {  // Editable fields
        setEditField(requestDetails.DateofNextTreatment, editPanel.childNextTreatmentDate);
        setEditField(patient.PatientFirstName, editPanel.childFirstName);
        setEditField(patient.PatientLastName, editPanel.childLastName);
        setEditField(patient.PatientGender, editPanel.childSex);
        setEditField(patient.PatientDateOfBirth, editPanel.childDOB);
        globals.functions.setProperty(editPanel, { visible: true });
    }
}
function prefillPEDDetails(data, panelObj, globals) {
    var data = JSON.parse(data);
    var reviewPanel = panelObj.claimsDetailsPanel.reviewPanel;
    if (reviewPanel) {
        setReviewField(data.childNextTreatmentDate, reviewPanel.reviewChildRecentTreatmentDate, 'reviewChildRecentTreatmentDate', globals);
        setReviewField(data.childFirstName, reviewPanel.reviewChildFirstname, 'reviewChildFirstname', globals);
        setReviewField(data.childLastName, reviewPanel.reviewChildLastName, 'reviewChildLastName', globals);
        setReviewField(data.childSex, reviewPanel.reviewChildSex, 'reviewChildSex', globals);
        setReviewField(data.childDOB, reviewPanel.reviewChildDOB, 'reviewChildDOB', globals);
    }
}

function setReviewField(value, target, fieldname, globals) {
    if (!target) return;
    if (value != null && value !== '') {
        globals.functions.setProperty(target, { visible: true });
        updateHtmlFieldValueByName(target, value, fieldname);
    } else {
        globals.functions.setProperty(target, { visible: false });
    }
}

function updateHtmlFieldValueByName(textObject, appendValue, fieldName) {
    var textNew = textObject.$value || "";
    if (appendValue && appendValue !== 'undefined') {
        appendValue = "<p class='" + fieldName + "'>" + appendValue + "</p>";
        textNew += appendValue;
    }
    $("#" + textObject.$id).html(textNew);
}
/* Save User Profile Data in browser storage && error handling*/
function baseSaveUserProfileData(response, isUpdate) {
	var apiResponse = '';
    if(isUpdate) {
		apiResponse = response && response.data && response.data.apiResponse && JSON.parse(response.data.apiResponse);
	}else {
		apiResponse = response;
	}
    if (apiResponse && apiResponse.admp_gp_atoken) {
        localStorage.setItem('admp_tpd', apiResponse.admp_gp_atoken);
        if (apiResponse.admp_jeess_per) {
            localStorage.setItem('admp_jeess_per', apiResponse.admp_jeess_per);
        }
        if (apiResponse.admp_pkcue) {
            localStorage.setItem('admp_pkcue', apiResponse.admp_pkcue);
        }
        if (apiResponse.admp_pkcue_frm) {
            localStorage.setItem('admp_pkcue_frm', apiResponse.admp_pkcue_frm);
        }
        if (apiResponse.admp_pkcue_n_frm) {
            localStorage.setItem('admp_pkcue_n_frm', apiResponse.admp_pkcue_n_frm);
        }
        if (apiResponse.admp_mi) {
            localStorage.setItem('admp_mi', apiResponse.admp_mi);
        }
        if (apiResponse.admp_fl) {
            setCookie('admp_ufln',apiResponse.admp_fl, apiResponse.cookie_seccure_flag, apiResponse.cookie_age);
            var admp_ufln = apiResponse.admp_fl;
            var res = admp_ufln.split("-");
            var firstName = window.sjcl.encrypt( 'AbbVie123$', res[0]);
            setCookie('HFN',firstName, apiResponse.cookie_seccure_flag, apiResponse.cookie_age);
        }
        baseStoreSavingsCardDetails(apiResponse);
        
        if (!isUpdate) {
            decryptResponseGcm('admp_tpd').then(function(decryptedData) {
                var userProfileResponse = JSON.parse(decryptedData);
                if (userProfileResponse.IsStatusSuccessful) {
                    baseSuccessPageRedirection(response);
                } else {
                    baseHandleErrorResponse(apiResponse);
                }
            })["catch"](function(error) {
                console.log("error in decryption");
            });
        }
    } else {
        baseHandleErrorResponse(apiResponse);
    }
}


/* handle page redirection */
function baseSuccessPageRedirection(response) {
    var redirectURL = '';
    var thankYouPageUrl = '';
    redirectURL = decodeURIComponent(baseGetCookieValue('admp_login_referrer'));
    //If redirection Url has absolute path and origin is same as that of the current page, pass only relative url
    redirectURL = redirectURL.indexOf(window.location.origin) > -1 ? redirectURL.split('.com')[1] : redirectURL;
    thankYouPageUrl = response.data.thankYouPageURL;
    if(thankYouPageUrl || redirectURL) {
        var url = thankYouPageUrl ? thankYouPageUrl : redirectURL;
        //validates and redirect to thankyou page
        baseURLRedirection(url);
    } else {
        //validates and redirect to thankyou page
        baseURLRedirection(window.location.origin);
    }
}

//STORE COPAY CARD DETAILS IN LC
function baseStoreSavingsCardDetails(apiResponse) {
	if (apiResponse && apiResponse.admp_gc_atoken) {
		localStorage.setItem('admp_cci', apiResponse.admp_gc_atoken);
	}
}

/* ER-479 code starts here */
function baseGetUserProfile(_brandName,_originName) {
	//var _brandName= localStorage.getItem('admp_bn');
    //var _originName= localStorage.getItem('admp_on');

   var reqObj = {
        url: "/abbviecloud/bin/abbvieforms/userprofile",
        method: 'post',
        async: false,
        data: {
         	brandName: _brandName,
        	originName: _originName
        }
    };
    $.ajax(reqObj)
        .done(function (response) {
            if (response) {
               baseSaveUserProfileData(response, false);
            }
        })
        .fail(function (error) {
            console.log(error.message);
        });
}
/* ER-479 code ends here */


var elementChanged = false;
var revokeAccessdata;
/**
 * getIndicationValue
 * @name getIndicationValue
 * @param {object} indicationField
 * @param {scope} globals
 */
function getIndicationValue(indicationField, globals) {
    var validIndications = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    var queryIndication = getQueryVariable("indication");
    var cookieIndication = baseGetCookieValue("indicationName");
    if (queryIndication !== "false" && validIndications.includes(queryIndication)) {
        globals.functions.setProperty(indicationField, {
            'value': queryIndication
        });
    } else if (cookieIndication !== "false" || cookieIndication !== null) {
        globals.functions.setProperty(indicationField, {
            'value': cookieIndication
        });
    } else {
        globals.functions.setProperty(indicationField, {
            'value': ''
        });
    }
}

/**
 * setGuidFromQuery
 * @name setGuidFromQuery
 * @param {object} field
 * @param {scope} globals
 */
function setGuidFromQuery(field, globals) {
    var guid = getQueryVariable("guid");
    if (guid !== "false") {
        globals.functions.setProperty(field, {
            'value': guid
        });
        setSessionCookie('guid', guid);
    }
}

/**
 * bspPrefillPersonalInfoPreview
 * @name bspPrefillPersonalInfoPreview
 * @param {object} section
 */
function bspPrefillPersonalInfoPreview(section) {
    decryptResponseGcm('admp_gp').then(function (decryptedData) {
        var result = JSON.parse(decryptedData);
        if (!result) return;

        var $panel = $('.' + section.$name);
        $panel.find('.firstname span').text(result.preferredName || '-');
        $panel.find('.userName .userflname').text((result.firstName || '') + ' ' + (result.lastName || ''));
        $panel.find('.Gender span').text(result.gender || '');
        $panel.find('.dateofBirth span').text(result.dateOfBirth ? bspFormatDate(result.dateOfBirth) : '');
        if (result.patientType && result.patientType === 'Patient') {
            bspUpdateProfileContactDetails($panel, result);
        }
        else
        {
			$panel.find ('.patient-contact-detail').hide();
        }
        handleAddressDisplay($panel, result);
        // NEW: call helper function
         var insuranceText = getInsuranceTextFromSurvey(result);
        $panel.find('.insuranceselection span').text(insuranceText);
    });
}

/* Displaying patient contact information */
/**
 * bspUpdateProfileContactDetails
 * @name bspUpdateProfileContactDetails
 * @param {object} section
 * @param {object} result
 */
function bspUpdateProfileContactDetails(section, result) {
    var $panel = section;
    var patientTypeResponse = result.patientType || '';
    if (result.phone && result.phone[0]) {
        if (result.phone[1] && result.phone[0].phoneNumber != result.phone[1].phoneNumber) {
            $panel.find('.contact span:first').html(baseFormatPhoneNumber(result.phone[0].phoneNumber) + ' (' + result.phone[0].phoneType.toLowerCase() + ')' + '<br>' + baseFormatPhoneNumber(result.phone[1].phoneNumber) + ' (' + result.phone[1].phoneType.toLowerCase() + ')');
        } else {
            $panel.find('.contact span:first').text(baseFormatPhoneNumber(result.phone[0].phoneNumber) + ' (' + result.phone[0].phoneType.toLowerCase() + ')');
        }
    }
    if (patientTypeResponse == 'Patient') {
         $panel.find('.contact span:last').text(result.email[0].emailAddress || '');
    } else if (patientTypeResponse == 'Caregiver') { 
         $panel.find('.contact span:last').text(result.caregiver[0].email[0].emailAddress || '');
    }
}

/* Displaying patient address information */
/**
 * handleAddressDisplay
 * @name handleAddressDisplay
 * @param {object} section
 * @param {object} result
 */
function handleAddressDisplay(section, result) {
    var $panel = section;
    var surveys = (result.arrayOfPatientSurvey && result.arrayOfPatientSurvey.surveys) || [];
    var insurance = surveys.find(function (s) {
        return s.questionId === '2';
    });
    var addressSection = $panel.find('.Address');
    var addressHeader = addressSection.find('p');
    // Remove previously appended address (avoid duplicate)
    addressHeader.find('span').remove();
    // If insurance question not found → hide
    if (!insurance) {
        addressSection.hide();
        return;
    }
    var responseId = Number(insurance.responseId);
    // Show ONLY when responseId === 5
    if (responseId === 5) {
        addressSection.show();
        if (result.address && result.address.length > 0) {
            addressHeader.append(formatAddress(result.address[0]));
        }
    } else {
        addressSection.hide();
    }
}

/* Format patient address information */
/**
 * formatAddress
 * @name formatAddress
 * @param {object} address
 */
function formatAddress(address) {
    if (!address) {
        return '';
    } 
    return '<span>' + 
        (address.addressLine1 ? address.addressLine1 + '<br>' : '')+
        (address.addressLine2 ? address.addressLine2 + '<br>' : '')+
        (address.city ? address.city + '<br>' : '')+
        (address.state ? address.state + '<br>' : '')+
        (address.zipcode ? address.zipcode + '<br>' : '')+
        '</span>'
}

/* get insurance name from survey */
/**
 * getInsuranceTextFromSurvey
 * @name getInsuranceTextFromSurvey
 * @param {object} result
 */
function getInsuranceTextFromSurvey(result) {
    var surveys = (result.arrayOfPatientSurvey && result.arrayOfPatientSurvey.surveys) || [];
    var insurance = surveys.find(s => s.questionId === '2');
    if (!insurance) {
    return '';
    }
    // Get the responseId
    var responseId = insurance.responseId;
    // Mapping values
    var insuranceMapping = {
        5: "I have private or commercial insurance from my employer or family member, or I buy my own through the Marketplace",
        7: "I am on Medicare (including Advantage and Supplemental Plans)",
        8: "I have a government-funded, Medicaid, or VA insurance plan",
        9: "I don't have insurance"
    };
    // Return mapped text
    return insuranceMapping[responseId] || '';
}

/* Convert date format of YYYY-MM-DD HH:mm:ss & YYYY-MM-DD to MM/DD/YYYY */
/**
 * bspFormatDate
 * @name bspFormatDate
 * @param {string} dateStr
 */
function bspFormatDate(dateStr) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
		return dateStr;
	} else {
		var datePart = dateStr.split(' ')[0];
		var parts = datePart.split('-');
		return parts[1] + '/' + parts[2] + '/' + parts[0];
	}
}

/**
 * bspDecryptAndProcess
 * @name bspDecryptAndProcess
 * @param {object} callback
 */
function bspDecryptAndProcess(callback) {
    decryptResponseGcm('admp_gp').then(function(decryptedData) {
        var result = JSON.parse(decryptedData);
        if (result) {
            callback(result);
            console.log(result);
        }
    });
}
/**
 * bspDecryptSavingsCardNum
 * @name bspDecryptSavingsCardNum
 * @param {object} section
 */
function bspDecryptSavingsCardNum(section) {
    bspDecryptAndProcess(function(result) {
        if(result.coPay && result.coPay[0]) {
            var coPayResult = result.coPay[0];
            localStorage.setItem('admp_cci', JSON.stringify(coPayResult));
            var copaycardDetails = '<div class="bsp-complete-saving-card-info"><p>' + coPayResult.rxBIN + '</p><p>' + coPayResult.rxPCN + '</p><p>' + coPayResult.rxGroup + '</p><p>' + coPayResult.rxIdentifier + '</p></div>';
            $(".bsp-complete-saving-card-info").remove();
            $(".bsp-complete-saving-card").html(copaycardDetails);
        }
    });
}

/* Prefill personal information form */
/**
 * bspPrefillPersonalInfoForm
 * @name bspPrefillPersonalInfoForm
 * @param {object} section
 * @param {scope} globals
 */
function bspPrefillPersonalInfoForm(section, globals) {
    bspDecryptAndProcess(function(result) {
        globals.functions.setProperty(section.additionalPatientId, {'value': result.additionalPatientId});
        globals.functions.setProperty(section.externalPatientId, {'value': result.externalPatientId});
        globals.functions.setProperty(section.patientId, {'value': result.patientId});
        globals.functions.setProperty(section.patientType, {'value': result.patientType});
        globals.functions.setProperty(section.legalFirstName, {'value': result.firstName});
        globals.functions.setProperty(section.preferredFirstName, {'value': result.preferredName});
        globals.functions.setProperty(section.legalLastName, {'value': result.lastName});
        globals.functions.setProperty(section.gender, {'value': result.gender});
        var dob = result.dateOfBirth ? bspFormatDate(result.dateOfBirth) : '';
        globals.functions.setProperty(section.dateOfBirth, {'value': dob});
        globals.functions.setProperty(section.patientTherapy.diagnosisName, {'value': result.patientTherapy[0].diagnosis[0].diagnosisName});

        var insRadioBtn = result.arrayOfPatientSurvey.surveys.find(function(x) {
            return x.questionId === '2';
        }) || '';
        if (insRadioBtn) {
            var insuranceText = getInsuranceTextFromSurvey(result);
            globals.functions.setProperty(section.campaignsPanel.campaign_1.campaign_1_responseid, {'value': insRadioBtn.responseId});
            globals.functions.setProperty(section.campaignsPanel.campaign_1.campaign_1_responsetext, {'value': insuranceText});
            globals.functions.setProperty(section.insuranceId, {'value': insRadioBtn.responseId});
        }
        if (insRadioBtn.responseId !== '5') {
            globals.functions.setProperty(section.locationEditPanel.address1TextBox, {visible: false});
            globals.functions.setProperty(section.locationEditPanel.address2TextBox, {visible: false});
            globals.functions.setProperty(section.locationEditPanel.cityTextBox, {visible: false});
            globals.functions.setProperty(section.locationEditPanel.stateTextBox, {visible: false});
            globals.functions.setProperty(section.locationEditPanel.zipcodeTextbox, {visible: false});
        }
        prefillPatientOrCaregiverContact(result, section, globals);
        bspSetTreatmentJourney(section, result, globals);
        if (result.address && result.address[0]) {
            var addr = result.address[0];
            var locationPanel = section.locationEditPanel;
            globals.functions.setProperty(locationPanel.address1TextBox, {'value': addr.addressLine1});
            globals.functions.setProperty(locationPanel.address2TextBox, {'value': addr.addressLine2});
            globals.functions.setProperty(locationPanel.cityTextBox, {'value': addr.city});
            globals.functions.setProperty(locationPanel.stateTextBox, {'value': addr.state});
            globals.functions.setProperty(locationPanel.zipcodeTextbox, {'value': addr.zipcode});
        }
    });
}

/* Prefill personal information form */
/**
 * prefillPatientOrCaregiverContact
 * @name prefillPatientOrCaregiverContact
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */
function prefillPatientOrCaregiverContact(result, section, globals) {
    if (result.patientType === 'Caregiver') {
        hidePatientContact(section, globals);
        bspPrefillCaregiverInfoForm(section, globals);
        return;
    }

    if (result.patientType === 'Patient') {
        prefillPatientPhone(result, section, globals);
        prefillPatientEmail(result, section, globals);
    }
}

/**
 * prefillPatientPhone
 * @name prefillPatientPhone
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */
function prefillPatientPhone(result, section, globals) {
    if (result.phone && result.phone.length) {
        globals.functions.setProperty(section.phoneInfo, {visible: true});
        for (var i = 0; i < result.phone.length; i++) {
            var phone = result.phone[i];
            if (phone.phoneType === 'Primary') {
                globals.functions.setProperty(section.phoneInfo.patient_phones_phone_1, {'value': baseFormatPhoneNumber(phone.phoneNumber)});
            } else if (phone.phoneType === 'Mobile') {
                globals.functions.setProperty(section.phoneInfo.patient_phones_phone_2, {'value': baseFormatPhoneNumber(phone.phoneNumber)});
                if (section.phoneInfo.prefillMobileNumber) {
                    globals.functions.setProperty(section.phoneInfo.prefillMobileNumber, {'value': phone.phoneNumber});
                }
                if (section.phoneInfo.SMSOptIn) {
                    globals.functions.setProperty(section.phoneInfo.SMSOptIn, {'value': phone.smsOptin});
                    if (phone.phoneNumber && phone.smsOptin == 'Yes') {
                        globals.functions.setProperty(section.phoneInfo.SMSOptIn, {readOnly: true});
                    } else {
                        globals.functions.setProperty(section.phoneInfo.SMSOptIn, {readOnly: false});
                    }
                }
            }
        }
    }
}

/**
 * prefillPatientEmail
 * @name prefillPatientEmail
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */
function prefillPatientEmail(result, section, globals) {
    if (result.email && result.email[0] && section.email) {
        globals.functions.setProperty(section.email, {visible: true});
        globals.functions.setProperty(section.email.emailTextbox, {'value': result.email[0].emailAddress});
    }
}

/**
 * hidePatientContact
 * @name hidePatientContact
 * @param {object} section
 * @param {scope} globals
 */
function hidePatientContact(section, globals) {
    globals.functions.setProperty(section.phoneInfo, {visible: false});
    globals.functions.setProperty(section.email, {visible: false});
}

/**
 * bspPrefillCaregiverInfoForm
 * @name bspPrefillCaregiverInfoForm
 * @param {object} section
  * @param {scope} globals
 */
function bspPrefillCaregiverInfoForm(section, globals) {
    bspDecryptAndProcess(function(result) {
        if (!result.caregiver || !result.caregiver.length || !result.caregiver[0]) return;
        var caregiver = result.caregiver[0];
        var smsOptin = result.phone[0].smsOptin;
        globals.functions.setProperty(section.additionalPatientId, {'value': result.additionalPatientId});
        globals.functions.setProperty(section.externalPatientId, {'value': result.externalPatientId});
        globals.functions.setProperty(section.patientId, {'value': result.patientId});
        globals.functions.setProperty(section.caregiverPanel.caregiverfirstName, {'value': result.caregiver[0].firstName});
        globals.functions.setProperty(section.caregiverPanel.caregiverlastName, {'value': result.caregiver[0].lastName});
        var caredob = caregiver.dateOfBirth ? bspFormatDate(caregiver.dateOfBirth) : '';
        globals.functions.setProperty(section.caregiverPanel.caregiverDateOfBirth, {'value': caredob});
        
        if (caregiver.phone && caregiver.phone.length) {
            for (var i = 0; i < caregiver.phone.length; i++) {
                var phone = caregiver.phone[i];
                if (phone.phoneType === 'Primary') {
                    globals.functions.setProperty(section.caregiverPanel.phoneInfo.phones_phone_1, {'value': baseFormatPhoneNumber(phone.phoneNumber)});
                } else if (phone.phoneType === 'Mobile') {
                    globals.functions.setProperty(section.caregiverPanel.phoneInfo.phones_phone_2, {'value': baseFormatPhoneNumber(phone.phoneNumber)});
                    if (section.caregiverPanel.phoneInfo.prefillMobileNumber) {
                        globals.functions.setProperty(section.caregiverPanel.phoneInfo.prefillMobileNumber, {'value': phone.phoneNumber});
                    }
                    if (section.caregiverPanel.phoneInfo.SMSOptIn) {
                        globals.functions.setProperty(section.caregiverPanel.phoneInfo.SMSOptIn, {'value': smsOptin});
                        if (phone.phoneNumber && smsOptin == 'Yes') {
                            globals.functions.setProperty(section.caregiverPanel.phoneInfo.SMSOptIn, {readOnly: true});
                        } else {
                            globals.functions.setProperty(section.caregiverPanel.phoneInfo.SMSOptIn, {readOnly: false});
                        }
                    }
                }
            }
        }

        if (caregiver.email && caregiver.email[0] && caregiver.email[0].emailAddress) {
            globals.functions.setProperty(section.caregiverPanel.caregiverEmail.caregiverEmailTextbox, {'value': caregiver.email[0].emailAddress});
        }
    });
}

/**
 * baseCompareFieldsValue
 * @name baseCompareFieldValue
 * @description Compare value of two field, returns false if not equal and true if equal
 * @param {object} fieldA
 * @param {object} fieldB
 */
function baseCompareFieldValue(fieldA, fieldB) {
    var valueA = fieldA && fieldA.$value;
    var valueB = fieldB && fieldB.$value;

    return valueA === valueB ? 'true' : 'false';
}

/**
 * bspSetTreatmentJourney
 * @name bspSetTreatmentJourney
 * @param {object} section
 * @param {object} result
* @param {scope} globals
 */
function bspSetTreatmentJourney(section, result, globals) {
    if (result.treatmentJourney && result.treatmentJourney[0]) {
        var journeyValue = result.treatmentJourney[0].treatmentJourney;
        var jourVal = (journeyValue === 'Journey3' || journeyValue === 'Journey2') ? journeyValue : '';
        globals.functions.setProperty(section.treatmentJourney.treatmentJourney, {'value': jourVal});
    }
}

/**
 * baseRemoveHypen
 * @name baseRemoveHypen
 * @param {string} phoneNumber
 * @param {scope} globals
 */
function baseRemoveHypen(phoneNumber) {
    if (phoneNumber.includes('-')) {
        return phoneNumber.replace(/-/g, '');
    }
    return phoneNumber;
}

/**
 * inputelemenChangeTracker
 * @name inputelemenChangeTracker
 * @param {object} section
 * @param {scope} globals
 */
function inputelemenChangeTracker(section, globals) {
    $('.' + section.$name).find('input, select').each(function(ele) {
        $(this).on('change', function() {
            elementChanged = true;
            $('.submit.button button').prop('disabled', false);
        });
    })
}

/**
* bspSetModalStatus
* Sets the redirection based on modal button clicks.
* @name bspSetModalStatus
* @param {string} urlRedirect - The text input object to set the value for redirect url
* @param {scope} globals
*/
function bspSetModalStatus(urlRedirect, globals) {
    if (elementChanged) {
        modalOpen();
        $('#okBtn').on('click', function() {
            elementChanged = false;
            modalClose();
            window.location.href = window.location.origin + urlRedirect;
        });
        $('#cancelBtn').on('click', function() {
            modalClose();
        });
    } else {
        elementChanged = false;
        modalClose();
        window.location.href = window.location.origin + urlRedirect;
    }
}

/**
* Add class name to the radio button group
* if the page is having more than one radio button group then the classname should be different for each radio button group
* Author all the description  in Long description ends with ';;'
* @name bspRadioHintLabel
* @param {object} field
* @param {scope} globals
*/
function bspRadioHintLabel(field) {
    var radioBtnGroupClassName = field.$properties.cssClass.split(' ')[0];
    var $radioGroup = $('.radiobutton .' + radioBtnGroupClassName);

    if ($radioGroup.length) {
        let $helpDesc = $radioGroup.find('.cmp-adaptiveform-radiobutton__longdescription'),
            helpDescText = $helpDesc.text(),
            $radioBtn = $radioGroup.find('.cmp-adaptiveform-radiobutton__option'),
            helpIconWrapperHTML = '<div class="cmp-adaptiveform-radiobutton__questionmark" style="position:static"></div>',
            helpDesWrapperHTML = '<div class="cmp-adaptiveform-radiobutton__longdescription__custom long" style="color: #666; background-color: #e6e6e6; margin-top: 10px; margin-bottom: 5px; padding: 10px; font-size: .875rem;"></div>';
            
        var helpDescArr = helpDescText.split(';;');
        var mainDescription = helpDescArr[0];
        $helpDesc.text(mainDescription);

        var $questionLabel = $radioGroup.find('.cmp-adaptiveform-radiobutton__label-container').first();

        if ($questionLabel.length) {
            $questionLabel.after($helpDesc);
        }

        $radioBtn.each(function (idx, val) {
            var $this = $(this);
            var descText = (idx + 1 < helpDescArr.length) ? helpDescArr[idx + 1].trim() : '';
            if (descText) {
                $this.find('label').after(helpIconWrapperHTML);
                $this.append(helpDesWrapperHTML);
                $this.find('.cmp-adaptiveform-radiobutton__longdescription__custom').text(descText).toggle();
                $this.find('.cmp-adaptiveform-radiobutton__questionmark').click(function (e) {
                    $(this).parents('.cmp-adaptiveform-radiobutton__option').find('.cmp-adaptiveform-radiobutton__longdescription__custom').toggle();
                    e.stopPropagation();
                });
            }
        });
    }
}

/* Prefill prospect information form */
/**
 * bspPrefillProspectForm
 * @name bspPrefillProspectForm
 * @param {object} section
  * @param {scope} globals
 */

function bspPrefillProspectForm(section, globals) {
    bspDecryptAndProcess(function(result) {
        globals.functions.setProperty(section.patientType, {'value' : result.patientType});
        globals.functions.setProperty(section.additionalPatientId, {'value' : result.additionalPatientId});
        bspSetPatientDetails(section, result, globals);
        bspSetCaregiverDetails(section, result, globals);
        bspSetContactInfo(section, result, globals);
        bspSetTreatmentJourney(section, result, globals);
        bspSetAddress(section, result, globals);
        bspSetInsuranceType(section, result, globals);
    });
}

/**
 * bspSetPatientDetails
 * @name bspSetPatientDetails
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */

function bspSetPatientDetails(section, result, globals) {
    var details = section.patientDetails;
    var dob = result.dateOfBirth ? bspFormatDate(result.dateOfBirth) : '';
    if  (dob){
        globals.functions.setProperty(section.dateOfBirth, {'value': dob});
    }
    if  ((result.patientType && result.patientType === 'Patient') || !result.patientType) {
        globals.functions.setProperty(details.patientInfoText, {visible: false});
        globals.functions.setProperty(details.patientFirstName, {visible: false});
        globals.functions.setProperty(details.preferredFirstName, {visible: false});
        globals.functions.setProperty(details.patientLastName, {visible: false});
        globals.functions.setProperty(details.patientFirstName, {'value' : result.firstName});
        globals.functions.setProperty(details.preferredFirstName, {'value' : result.preferredName});
        globals.functions.setProperty(details.patientLastName, {'value' : result.lastName});
    } else {
        globals.functions.setProperty(details.patientInfoText, {visible: true});
        globals.functions.setProperty(details.patientFirstName, {visible: true});
        globals.functions.setProperty(details.preferredFirstName, {visible: true});
        globals.functions.setProperty(details.patientLastName, {visible: true});
    }
}

/**
 * bspSetCaregiverDetails
 * @name bspSetCaregiverDetails
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */

function bspSetCaregiverDetails(section, result, globals) {
    var caregiver = section.caregiver;
    var isLegacy = result.caregiver && result.caregiver[0];
    var dob = result.dateOfBirth ? bspFormatDate(result.dateOfBirth) : '';
    if (result.patientType && result.patientType === 'Caregiver' && !isLegacy) {
        globals.functions.setProperty(caregiver.careFirstName, {'value' : result.firstName});
        globals.functions.setProperty(caregiver.careLastName, {'value' : result.lastName});
        globals.functions.setProperty(caregiver.careDateOfBirth, {visible : true});
    } else if (result.patientType && result.patientType === 'Caregiver' && isLegacy) {
        globals.functions.setProperty(caregiver.careFirstName, {'value' : result.caregiver[0].firstName});
        globals.functions.setProperty(caregiver.careLastName, {'value' : result.caregiver[0].lastName});
        globals.functions.setProperty(caregiver.careDateOfBirth, {visible : true});
        globals.functions.setProperty(section.dateOfBirth, {'value': dob});
    } else {
        globals.functions.setProperty(caregiver.careDateOfBirth, {visible : false});
    }
}

/**
 * bspSetContactInfo
 * @name bspSetContactInfo
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */

function bspSetContactInfo(section, result, globals) {
    if (result.phone) {
        for (var i = 0; i < result.phone.length; i++) {
            var e = result.phone[i];
            if (e.phoneType === 'Mobile') {
                globals.functions.setProperty(section.consentPanel.phonesArray.mobileNumber, {'value' : baseFormatPhoneNumber(e.phoneNumber)});
            }
        }
    }
    if (result.email && result.email[0].emailAddress) {
        if (result.patientType && result.patientType === 'Caregiver') {
            globals.functions.setProperty(section.caregiver.careEmailInfo.emailAddress, {'value' : result.email[0].emailAddress});
        } else {
            globals.functions.setProperty(section.emailInfo.emailAddress, {'value' : result.email[0].emailAddress});
        }
    }
}


/**
 * bspSetAddress
 * @name bspSetAddress
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */

function bspSetAddress(section, result, globals) {
    var locationPanel = section.insuranceDetails.locationEditPanel;
    if (result.address && result.address[0]) {
        var addr = result.address[0];
        globals.functions.setProperty(locationPanel.address1TextBox, {'value': addr.addressLine1});
        globals.functions.setProperty(locationPanel.address2TextBox, {'value': addr.addressLine2});
        globals.functions.setProperty(locationPanel.cityTextBox, {'value': addr.city});
        globals.functions.setProperty(locationPanel.stateTextBox, {'value': addr.state});
        if (addr.zipcode && addr.zipcode != '') {
            globals.functions.setProperty(locationPanel.zipcodeTextbox, {'value': addr.zipcode});
        } else {
            globals.functions.setProperty(locationPanel.zipcodeTextbox, {visible : true});
            globals.functions.setProperty(locationPanel.zipcodeTextbox, {readOnly : false});
        }
    } else {
        globals.functions.setProperty(locationPanel.zipcodeTextbox, {visible : true});
        globals.functions.setProperty(locationPanel.zipcodeTextbox, {readOnly : false});
    }
}

/**
 * bspSetIndication
 * @name bspSetIndication
 * @param {string} indicationCookie
 */
function bspSetIndication(indicationCookie) {
    var $indication = $('.indicationSelected');
    var indicationCookieValue = baseGetCookieValue(indicationCookie);
    var indicationTexts = {
        '6': 'Adult Overactive Bladder (age 18+)',
        '7': 'Adult Overactive Bladder due to a Neurologic Condition (age 18+)',
        '1': 'Adult Spasticity (age 18+)',
        '3': 'Blepharospasm (age 12+)',
        '4': 'Cervical Dystonia (age 16+)',
        '5': 'Chronic Migraine (age 18+)',
        '8': 'Pediatric Overactive Bladder due to Neurologic Condition (ages 5-17)',
        '2': 'Pediatric Spasticity (ages 2-17)',
        '9': 'Severe Underarm Sweating (age 18+)',
        '10': 'Strabismus (age 12+)'
    };

    $indication.text(indicationTexts[indicationCookieValue] || '');
}


/**
 * bspSetInsuranceType
 * @name bspSetInsuranceType
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */

function bspSetInsuranceType(section, result, globals) {
    if (result.arrayOfPatientSurvey && result.arrayOfPatientSurvey.surveys) {
        var surveys = result.arrayOfPatientSurvey.surveys;
        for (var i = 0; i < surveys.length; i++) {
            if (surveys[i].questionId == '2') {
                globals.functions.setProperty(section.insuranceDetails.campaign_2.campaign_2_responseid, {'value' : surveys[i].responseId});
                break;
            }
        }
        if (section.insuranceDetails.campaign_2.campaign_2_responseid.value !== '5') {
            globals.functions.setProperty(section.insuranceDetails.locationEditPanel.address1TextBox, {visible : false});
            globals.functions.setProperty(section.insuranceDetails.locationEditPanel.address2TextBox, {visible : false});
            globals.functions.setProperty(section.insuranceDetails.locationEditPanel.cityTextBox, {visible : false});
            globals.functions.setProperty(section.insuranceDetails.locationEditPanel.stateTextBox, {visible : false});
        }
    }
}

/**
 * @name bspPatientInfoSubmit
 * @param {string} campaignKey
 * @param {object} hiddenCampaignsObj
 * @param {object} insuranceType
 * @param {scope} globals
 */
function bspPatientInfoSubmit(campaignKey, hiddenCampaignsObj, insuranceType, globals) {
    if (insuranceType.$value !== '5') {
        globals.functions.setProperty(globals.form.guideRootPanel.updateInfoPanel.locationEditPanel.address1TextBox, {'value': ''});
        globals.functions.setProperty(globals.form.guideRootPanel.updateInfoPanel.locationEditPanel.address2TextBox, {'value': ''});
        globals.functions.setProperty(globals.form.guideRootPanel.updateInfoPanel.locationEditPanel.cityTextBox, {'value': ''});
        globals.functions.setProperty(globals.form.guideRootPanel.updateInfoPanel.locationEditPanel.stateTextBox, {'value': ''});
        eapiOnSubmit(campaignKey, hiddenCampaignsObj, globals);
    } else {
        eapiOnSubmit(campaignKey, hiddenCampaignsObj, globals);
    }
}

/**
 * baseValidateAgeByIndication
 * @name baseValidateAgeByIndication
 * @param {object} date
 * @param {object} patientType
 * @param {object} errorPanel
 * @param {scope} globals
 */

function baseValidateAgeByIndication(date, patientType, errorPanel, globals) {

    var age = calculate_age(date.$value);
    var url = window.location.href;
    var indication = url.includes('botox-complete-conversion')
        ? baseGetCookieValue('indicationId')
        : baseGetCookieValue('indicationName');

    if (!baseIsValidDate(date, globals)) {
        globals.functions.setProperty(date, {'errorMessage': 'Please enter a valid date of birth.'});

        return false;
    }
    var mustBeAdult = ['1','5','6','7','9'];
    if (mustBeAdult.includes(indication) && age < 18) {
		globals.functions.setProperty(date, {'errorMessage': errorPanel.ageBelow18YearErrMsg.$value});
        return false;
    }
    if (patientType.$value === 'Patient') {
        return validatePatientAge(indication,age,date,errorPanel,globals);
    }
    if (patientType.$value === 'Caregiver') {
        return validateCareGiverAge(indication,age,date,errorPanel,globals);
    }
}
/**
 * validateAgeLimit
 * @name validateAgeLimit
 * This function used to validate the vraylar form dob based on indication. 
 * @param {Number} age
 * @param {object} date
 * @param {object} errorField
 * @param {string} indication
 * @param {object} globalIndication
 * @param {scope} globals
 * @returns {boolean}
 */
function validateAgeLimit(age, date, errorField, indication, globalIndication, globals) {
    if (globalIndication.$value === indication) {
        var calcAge = calculate_age(date.$value);
        if (calcAge < age) {
            globals.functions.setProperty(date, {'errorMessage': errorField.$value});
            return false;
        }
    }
    return true;
}
/**
 * validatePatientAge
 * @name validatePatientAge
 * @param {string} indication
 * @param {Number} age
 * @param {object} date
 * @param {object} errorPanel
 * @param {scope} globals
 */

function validatePatientAge(indication,age,date,errorPanel,globals) {
    if (indication === '8' || indication === '2') {
		globals.functions.setProperty(date, {'errorMessage': errorPanel.pediatricPatientError.$value});
        return false;
    }
    if (age < 18 && (indication === '3' || indication === '10' || indication === '4')) {
	    globals.functions.setProperty(date, {'errorMessage': errorPanel.otherIndicationsPatientError.$value});

        return false;
    }
    return true;
}

/**
 * validateCareGiverAge
 * @name validateCareGiverAge
 * @param {string} indication
 * @param {Number} age
 * @param {object} date
 * @param {object} errorPanel
 * @param {scope} globals
 */
function validateCareGiverAge(indication,age,date,errorPanel,globals) {
    var mustBeTwelve = ['3','10'];
    if (mustBeTwelve.includes(indication) && age < 12) {
		globals.functions.setProperty(date, {'errorMessage': errorPanel.caregiverBelow12Error.$value});

        return false;
    }
    else if (indication === '4' && age < 16) {
		globals.functions.setProperty(date, {'errorMessage': errorPanel.caregiverBelow16error.$value});

        return false;
    }
    else if (indication === '8' && (age >= 18 || age < 5)) {
		globals.functions.setProperty(date, {'errorMessage': errorPanel.caregiver5to17Error.$value});

        return false;
    }
    else if (indication === '2' && (age >= 18 || age < 2)) {
		globals.functions.setProperty(date, {'errorMessage': errorPanel.caregiver2to17Error.$value});

        return false;
    }
    return true;
}
/**
 * validateCareGiverAge
 * @name validateCareGiverAge
 * @param {string} birth
 */

function calculate_age(birth) {
   var today = new Date();
   var curr_date = today.getDate();
   var curr_month = today.getMonth() + 1;
   var curr_year = today.getFullYear();

   var pieces = birth.split('/');
   var birth_month = pieces[0];
   var birth_date = pieces[1];
   var birth_year = pieces[2];


   if (curr_month == birth_month && curr_date >= birth_date) return parseInt(curr_year-birth_year);
   if (curr_month == birth_month && curr_date < birth_date) return parseInt(curr_year-birth_year-1);
   if (curr_month > birth_month) return parseInt(curr_year-birth_year);
   if (curr_month < birth_month) return parseInt(curr_year-birth_year-1);
}

/**
 * baseUpdateReviewText
 * @name baseUpdateReviewText
 * @param {string} className
 * @param {object} field
 */
function baseUpdateReviewText(className, field) {
  var $element = $('.' + className);
  var value = field.$value;
  switch (field.$fieldType) {
    case 'text-input':
      $element.text(value || '');
      break;
    case 'radio-group':
      var idx = field.$enum.indexOf(value);
      $element.html(idx !== -1 ? field.$enumNames[idx] : '');
      break;
    case 'drop-down':
      var idx = field.$enum.indexOf(value);
      $element.text(idx !== -1 ? field.$enumNames[idx] : '');
      break;
    default:
      $element.text('');
  }
}


/**
 * bspshowClaimsManagement
 * @name bspshowClaimsManagement
 * @param {object} result
 * @param {object} section
 * @param {scope} globals
 */

function bspshowClaimsManagement(section,globals) {
    bspDecryptAndProcess(function(result) {
        var $panel = $('.claims-managedBy');
        var $container = $('.titlePanel');
        var provideConsentTxt = $container.find('.provideConsentBtn span').text().replace(/\n/g, '');
        var manageSelf = $container.find('.manageClaimBtn').text().replace(/\n/g, '');
        var selfMangedProfile = true;
        var email;
        if (result.patientType.toLowerCase() === 'caregiver') {
            email = result.caregiver[0].email[0].emailAddress || '';
        } else {
            email = result.email[0].emailAddress || '';
        }
        $('.bspPatientId input').val(result.patientId);
        $('.bspExternalPatientIdAPI input').val(result.externalPatientId);
        $('.email input').val(email);
        var $pendingContainer = $panel.find('.hcpConsentPending').not('.hcpAdded');
        revokeAccessdata ={
                "externalPracticeId": "",
                "npi":""
        }
        if(result.claims && result.claims[0]){
                $.each(result.claims, function(index, obj) {
                    if ((obj.consentStatus.toLowerCase() === 'approved') || (obj.consentStatus.toLowerCase() === 'pending')){
                        selfMangedProfile = false;
                    }
                });
            }
        if(selfMangedProfile){
			$container.append($panel.find('.selfManagedClaimsPanel').not(".selfAdded").clone().addClass('selfAdded').removeClass('hidden'));
        }
        else{
			if (result.claims && result.claims.length > 0) {
            var currentDate = new Date();
            $.each(result.claims, function(index, obj) {
                var consentStatus = obj.consentStatus.toLowerCase() || '';
                var $approvedContainer = $panel.find('.consentApproved').not('.approvedConcent');
                var $approvedToExpiry = $panel.find('.annualConsentForm').not('.annualConsentHcp');
                if (consentStatus === 'approved') {
                    var $approvedContainer;
                    var expiryDt = new Date(obj.consentExpiryDate);
                    var diffInDays = Math.floor((expiryDt - currentDate) / (1000 * 60 * 60 * 24));
                    if (diffInDays < 30 && diffInDays >= -1) {                        
                        var $approvedItemAboutToExpiry = $('<div class="approvedItemAboutToExpiry"></div>');                       
                        $approvedItemAboutToExpiry.append($approvedToExpiry.find('h4').clone());
                        $('<p class="hcpNameForClaim">' + obj.requestingPracticeName + '</p>').appendTo($approvedItemAboutToExpiry);
                        $approvedItemAboutToExpiry.append($approvedToExpiry.find('p').not('.hcpNameForClaim').clone());
                        $('<button class="redirectBtn" type="button">'+provideConsentTxt+'</button>').attr('data-href', obj.consentRequestURL).appendTo($approvedItemAboutToExpiry);
                        $container.append($approvedItemAboutToExpiry);
                    } else if (diffInDays < -1) {
                        $container.append($panel.find('.selfManagedClaimsPanel').not(".selfAdded").clone().addClass('selfAdded').removeClass('hidden'));
                    } else {
                        var $approvedItem = $('<div class="approvedItem"></div>');                       
                        $approvedItem.append($approvedContainer.find('h4').clone());
                        $('<p class="hcpNameForClaim">' + obj.requestingPracticeName + '</p>').appendTo($approvedItem);
                        $approvedItem.append($approvedContainer.find('p').not('.hcpNameForClaim').clone());
                        $('<button class="manageSelfBtn" type="button">'+manageSelf+'</button>').attr({'data-practiceID': obj.practiceId, 'data-npi': obj.requestingPracticeNPI}).appendTo($approvedItem);
                        $container.append($approvedItem);
                    }
                } else if (consentStatus === 'pending') {                    
                    var $pendingItem = $('<div class="pendingItem"></div>');
                    $pendingItem.append($pendingContainer.find('h4').clone());
                    $('<p class="hcpNameForClaim"></p>').text(obj.requestingPracticeName).appendTo($pendingItem);
                    $pendingItem.append($pendingContainer.find('p').not('.hcpNameForClaim').clone());
                    $('<button type="button" class="redirectBtn"></button>').attr('data-href', obj.consentRequestURL).text(provideConsentTxt).appendTo($pendingItem);
                    $container.append($pendingItem);
                }
            });
        }
        }
        $('.consentApproved:not(.approvedConcent), .annualConsentForm:not(.annualConsentHcp), .hcpConsentPending:not(.hcpAdded)').remove();

    });
     //adding click event to redirect 3rd party dynamic url
    $(document).on('click', '.redirectBtn', function(){
        window.location.href = $(this).attr('data-href');
    });
    $(document).on('click', '.manageSelfBtn', function(e){
        revokeAccess(e.target, globals);
    });
}

/**
 * revokeAccess
 * @name revokeAccess
 * @param {object} section
 * @param {scope} globals
 */

function revokeAccess(section, globals){
    $el = $(section);
    $('.titlePanel > div:not(:first), .profilePanel').hide();
    $('.switch-to-self-manage').attr('data-cmp-visible', 'true');
    globals.functions.setProperty(globals.form.guideRootPanel.claimManager.revokeAccessHCP.consentPanel.billingPractice.npi, {'value': $el.attr('data-npi')});
    globals.functions.setProperty(globals.form.guideRootPanel.claimManager.revokeAccessHCP.consentPanel.externalPracticeID, {'value': $el.attr('data-practiceID')});
}

/**
 * elemenChangeTracker
 * @name elemenChangeTracker
 * @param {object} section
 */
function elemenChangeTracker(section) {
    $('.' + section.$name).find('input, select').each(function(element) {
        $(this).on('change', function() {
            elementChanged = true;
        });
    })
}

/**
* bspShowModal
* @name bspShowModal
* @param {object} readOnlyPanel
* @param {object} editablePanel
* @param {object} submitButton
* @param {object} backButton
* @param {scope} globals
*/
function bspShowModal(readOnlyPanel, editablePanel, submitButton, backButton, globals) {
    if (elementChanged) {
        modalOpen();
        $('#okBtn').on('click', function() {
            elementChanged = false;
            modalClose();
            globals.functions.setProperty(readOnlyPanel, {visible: true});
            globals.functions.setProperty(editablePanel, {visible: false});
            globals.functions.setProperty(submitButton, {enabled: true});
            globals.functions.setProperty(backButton, {enabled: true});
        });
        $('#cancelBtn').on('click', function() {
            modalClose();
        });
    } else {
        elementChanged = false;
        modalClose();
        globals.functions.setProperty(readOnlyPanel, {visible: true});
        globals.functions.setProperty(editablePanel, {visible: false});
        globals.functions.setProperty(submitButton, {enabled: true});
        globals.functions.setProperty(backButton, {enabled: true});
    }
}


/**
 * prefillProspectProfileSection
 * @name prefillProspectProfileSection
 * @param {object} section
 * @param {scope} globals
 */
function prefillProspectProfileSection(section, globals) {
	bspDecryptAndProcess(function(result) {
        if( result) {
            globals.functions.setProperty(section.additionalPatientId, {'value' : result.additionalPatientId});
            globals.functions.setProperty(section.firstNameTextbox, {'value' : result.firstName});
            globals.functions.setProperty(section.lastNameTextbox, {'value' : result.lastName});
            if (result.patientTherapy.length && result.patientTherapy[0].diagnosis.length && result.patientTherapy[0].diagnosis[0].diagnosisName) {
                 var primaryCondition = section.patientTherapy.diagnosis.diagnosisName;
                  globals.functions.setProperty(primaryCondition, {'value' : result.patientTherapy[0].diagnosis[0].diagnosisName});
            }
            if (result.email && result.email.length && result.email[0].emailAddress) {
                globals.functions.setProperty(section.emailPanel.emailTextbox, {'value' : result.email[0].emailAddress});
            }
            if (result.patientType) {
                globals.functions.setProperty(section.patientOrCaregiverRadio, {'value' : result.patientType});
                globals.functions.setProperty(section.patientOrCaregiverRadio, {readOnly : true});
            } else {
                globals.functions.setProperty(section.patientOrCaregiverRadio, {readOnly : false});
            }
        }
   });
}

/* Prefill new claim form */
/**
 * bspPrefillSubmitAClaimForm
 * @name bspPrefillSubmitAClaimForm
 * @param {object} section
 * @param {scope} globals
 */
function bspPrefillSubmitAClaimForm(section, globals) {
    bspDecryptAndProcess(function(result) {
        globals.functions.setProperty(section.bspPatientId, {'value': result.patientId});
        globals.functions.setProperty(section.bspExternalPatientId, {'value': result.externalPatientId});
        globals.functions.setProperty(section.editablePersonalInfo.legalFirstName, {'value': result.firstName});
        globals.functions.setProperty(section.editablePersonalInfo.legalLastName, {'value': result.lastName});
        globals.functions.setProperty(section.editablePersonalInfo.gender, {'value': result.gender});
		var dob = result.dateOfBirth ? bspFormatDate(result.dateOfBirth) : '';
        globals.functions.setProperty(section.editablePersonalInfo.dateOfBirth, {'value': dob});
		var $panel = $('.' + section.$name);
        $panel.find('.bsppatientid').text(result.patientId || '');
        $panel.find('.bspexternalpatientid').text(result.externalPatientId || '');
        $panel.find('.legalfirstname').text(result.firstName || '');
        $panel.find('.legallastname').text(result.lastName || '');
        $panel.find('.bsppatientgender').text(result.gender || '');
        $panel.find('.bsppatientdob').text(dob);
        $('.new-claim-panel .review-panel .patient-information-panel .editable-personal-info-panel').hide();
		if (result.address && result.address[0]) {
            var addr = result.address[0];
            var locationPanel = section.editablePersonalInfo.locationEditPanel;
			globals.functions.setProperty(locationPanel.address1TextBox, {'value': addr.addressLine1});
			globals.functions.setProperty(locationPanel.address2TextBox, {'value': addr.addressLine2});
			globals.functions.setProperty(locationPanel.cityTextBox, {'value': addr.city});
			globals.functions.setProperty(locationPanel.stateTextBox, {'value': addr.state});
			globals.functions.setProperty(locationPanel.zipcodeTextbox, {'value': addr.zipcode});
            $panel.find('.bspClaimAddress1').append(addr.addressLine1 || '');
            $panel.find('.bspClaimAddress2').append(addr.addressLine2 || '');
            $panel.find('.bspClaimCity').append(addr.city || '');
            $panel.find('.bspClaimState').append(addr.state || '');
            $panel.find('.bspClaimZipcode').append(addr.zipcode || '');
        }
		if (result.coPay && result.coPay[0]) {
            var coPayResult = result.coPay[0];
            var copayPanel = section.copayPanel;
			globals.functions.setProperty(copayPanel.bspMemberId, {'value': coPayResult.rxIdentifier});
			globals.functions.setProperty(copayPanel.bspGroupNumber, {'value': coPayResult.rxGroup});
            $panel.find('.bsppatientmemberid').append(coPayResult.memberId || '');
            $panel.find('.bsppatientgroupnumber').append(coPayResult.groupNumber || '');
        }
		var patientType = result.patientType || '';
        var emailResult;
        var emailPanel = section.emailPanel;
        if (patientType == 'Patient' && result.email && result.email[0]) {
            emailResult = result.email[0];
        } else if (patientType == 'Caregiver' && result.caregiver[0] && result.caregiver[0].email[0]) {
            emailResult = result.caregiver[0].email[0];
        }
		if (emailResult) {
			globals.functions.setProperty(emailPanel.bspEmailAddress, {'value': emailResult.emailAddress});
            $panel.find('.bsppatientemailaddress').append(emailResult.emailAddress || '');
        }
    });
}

//Accordion within form
function bspFormAccordion(){
    $('.bsp-accordion-content').hide();
    $('.bsp-accordion-header, .bsp-collapse-accordion').on('click', function() {
        var $accordionContent;
        if ($(this).hasClass('bsp-collapse-accordion')) {
            $accordionContent = $(this).parent();
        } else {
            $accordionContent = $(this).next('.bsp-accordion-content');
        }
        $accordionContent.toggle();
        $('.bsp-accordion-header').toggleClass('abbv-icon-keyboard_arrow_up_forms');
    });
}

//Attach a click event listener to specific modal trigger elements.
$(document).on(
    'click',
    '.eob-modal, .eob-desc, .remittance-Advice, .physician-Receipts, .specialty-Pharmacy, .physicianReceipts-Sample, .specialtyPharmacy-Sample, .remittanceAdvice-Sample, .infoUpdate-Alert',
    function(e) {
        e.preventDefault();
        const modalContext = window.parent?.abbvModal || window?.abbvModal || abbvModal;
        modalContext?.openModal(this);
    }
);

//Handles modal interactions and UI state updates for the New Claim form.
$(document).ready(function(){   
	$('.infoUpdateAlert .abbv-modal-close').on('click', function(){
	    scrollTopOnFormInit();
		$('.new-claim-panel .review-panel .patient-information-panel .read-only-panel').hide();
		$('.new-claim-panel .review-panel .patient-information-panel .edit-button').hide();
		$('.new-claim-panel .review-panel .patient-information-panel .editable-personal-info-panel').attr('data-cmp-visible', true).show();
		$('.new-claim-panel .review-panel .patient-information-panel .editable-personal-info-panel .update-panel').attr('data-cmp-visible', true).show();
		$('.new-claim-panel .toolbar-panel .submit-button').parents('.submit').removeClass('button');
		$('.new-claim-panel .toolbar-panel .submit-button').prop('disabled', true);
		$('.new-claim-panel .save-button').prop('disabled', true);
	});
	$('#okBtn').on('click', function () {
        togglePatientInfoPanels();
    	$('.new-claim-panel .toolbar-panel .submit-button').parents('.submit').addClass('button');
    });
    $('.submit.button button.save-button').on('click', function () {
        var $editablePanel = $('.new-claim-panel .review-panel .patient-information-panel .editable-personal-info-panel');
        if ($editablePanel.find('[data-cmp-valid="false"]').length > 0) {
            return;
        }
        togglePatientInfoPanels();
    	$('.new-claim-panel .toolbar-panel .submit-button').parents('.submit').addClass('button');
    });
    $('.button button.cancel-button').on('click', function () {
        if (!elementChanged) {
            togglePatientInfoPanels();
        }
    });
});

function togglePatientInfoPanels() {
    $('.new-claim-panel .review-panel .patient-information-panel .read-only-panel').attr('data-cmp-visible', true).show();
    $('.new-claim-panel .review-panel .patient-information-panel .edit-button').attr('data-cmp-visible', true).show();
    $('.new-claim-panel .review-panel .patient-information-panel .editable-personal-info-panel').hide().find('.update-panel').hide();
    $('.new-claim-panel .toolbar-panel .submit-button').prop('disabled', false);
}

/**
 * isSurveyChecked
 * @name isSurveyChecked
 * @param {object} surveys
 * @param {string} questionId
 * @param {string} responseId
 */
function isSurveyChecked(surveys, questionId, responseId) {
   var pref = surveys.find(function(s) {
        return s.questionId === questionId;
    }) || '';
    return pref && pref.responseId === responseId;
}

/**
 * bspPrefillTRMobileNumber
 * @name bspPrefillTRMobileNumber
 * @param {boolean} phoneChecked
 * @param {string} treatmentPhoneNumber
 * @param {object} section
 * @param {object} result
 * @param {scope} globals
 */
function bspPrefillTRMobileNumber(phoneChecked, treatmentPhoneNumber, section, result, globals) {
    var patientType = result.patientType || '';
    if (phoneChecked && treatmentPhoneNumber) {
        globals.functions.setProperty(section.mobileNumberTextbox, {'value': baseFormatPhoneNumber(treatmentPhoneNumber)});
        globals.functions.setProperty(section.mobileNumberTextbox, {'readOnly': true});
        globals.functions.setProperty(section.smsOptin, {'value': 'Yes'});
    } else if (result.phone || result.caregiver[0].phone) {
        if (result.phone.length) {
            var mobile = result.phone.find(function(e) {
                if (e.phoneType) {
                    return e.phoneType === 'Mobile';
                }
            }) || '';
        }
        if (result.caregiver && result.caregiver[0].phone) {
            var mobileCare = result.caregiver[0].phone.find(function(e) {
                if (e.phoneType) {
                    return e.phoneType === 'Mobile';
                }
            }) || '';
        }
        if (mobile && patientType === 'Patient') {
            globals.functions.setProperty(section.mobileNumberTextbox, {'value': baseFormatPhoneNumber(mobile.phoneNumber)});
            globals.functions.setProperty(section.mobileNumberTextbox, {'readOnly': true});
            globals.functions.setProperty(section.smsOptin, {'value': mobile.smsOptin});
        } else if (mobileCare && patientType === 'Caregiver') {
            globals.functions.setProperty(section.mobileNumberTextbox, {'value':  baseFormatPhoneNumber(mobileCare.phoneNumber)});
            globals.functions.setProperty(section.mobileNumberTextbox, {'readOnly': true});
            globals.functions.setProperty(section.smsOptin, {'value': mobile.smsOptin});
        }
        if ((patientType === 'Caregiver') && (result.phone[0].smsOptin === 'Yes')) {
            var smsOptinVal = result.phone[0].smsOptin || '';
            globals.functions.setProperty(section.smsOptin, {'value': smsOptinVal});
        }
    } else {
        globals.functions.setProperty(section.mobileNumberTextbox, {'value': ''});
        globals.functions.setProperty(section.mobileNumberTextbox, {'readOnly': false});
        globals.functions.setProperty(section.smsOptin, {'value': ''});
    }
}

/**
 * bspTreatmentRemindersIntervals
 * @name bspTreatmentRemindersIntervals
 * @param {object} section
 * @param {string} conditionValue
 * @param {scope} globals
 */
function bspTreatmentRemindersIntervals(section, conditionValue, globals) {
    var treatmentMonthOptions = getMonthOptionsById(conditionValue);
    bspPopulateIntervalDropDownValues(section.remaindersTimeSpanDropDown, treatmentMonthOptions, "", "", globals);
    function getMonthOptionsById(conditionId) {
        var startMonth;
        var options = { '1': 3, '2': 3, '3': 3, '4': 3, '5': 3, '6': 6, '7': 10, '8': 7, '9': 6, '10': 3 };
        startMonth = options[conditionId] || 3;
        $('.time-span').text(startMonth);
        var monthOptions = {};
        for (var month = startMonth; month <= 12; month++) {
            monthOptions[month + ' Months' ] = month.toString();
        }
        return monthOptions;
    }
}

/**
 * bspPopulateIntervalDropDownValues
 * @name bspPopulateIntervalDropDownValues
 * @param {object} dropdownField
 * @param {object} optionsObj
 * @param {string} prefixKey
 * @param {string} postFixKey
 * @param {scope} globals
 */
function bspPopulateIntervalDropDownValues(dropdownField, optionsObj, prefixKey, postFixKey, globals ) {
    var enumValues = [];
    var enumNamesValues =[];
  	var dropdownFieldClassName = dropdownField.$name;
  	var $dropdownElement = $('.'+dropdownFieldClassName+' select');
    $dropdownElement.empty();
    for (var key in optionsObj) {
        var keyValue = prefixKey ? prefixKey + " " + optionsObj[key] : optionsObj[key] + " " + postFixKey;
        //$dropdownElement.append($('<option>').text(keyValue).attr('value',key));
        enumValues.push(key);
        enumNamesValues.push(keyValue);
	}
    globals.functions.setProperty(dropdownField, {'enum': enumValues});
    globals.functions.setProperty(dropdownField, {'enumNames': enumNamesValues});
}

/**
 * bspTreatmentRemindersFootNote
 * @name bspTreatmentRemindersFootNote
 * @param {object} section
 * @param {string} condition
 * @param {string} frequency
 * @param {scope} globals
 */
function bspTreatmentRemindersFootNote(section, condition, frequency, globals) {
    if (frequency) {
       setTimeout(function () { 
        globals.functions.setProperty(section.remaindersTimeSpanDropDown, {'value': frequency}); 
        if (section.remaindersTimeSpanDropDown.dispatchEvent) {
            section.remaindersTimeSpanDropDown.dispatchEvent(
                new Event('change', { bubbles: true })
            );
        }    
    }, 400);
    } else {
        var freqMonth = section.remaindersTimeSpanDropDown.$enum[0];
        globals.functions.setProperty(section.remaindersTimeSpanDropDown, {'value': freqMonth});
    }
    globals.functions.setProperty(section.primaryConditionDropdown, {'value': condition});
    if (condition) {
        switch (condition) {
            case '1':
                globals.functions.setProperty(section.reminderFootNoteTextAdultSpasticity, {'visible': true});
                break;
            case '2':
                globals.functions.setProperty(section.reminderFootNoteTextPediatricSpasticity, {'visible': true});
                break;
            case '3':
                globals.functions.setProperty(section.reminderFootNoteTextBlepharospasm, {'visible': true});
                break;
            case '4':
                globals.functions.setProperty(section.reminderFootNoteTextCervicalDystonia, {'visible': true});
                break;
            case '5':
                globals.functions.setProperty(section.reminderFootNoteTextChronicMigrane, {'visible': true});
                break;
            case '6':
                globals.functions.setProperty(section.reminderFootNoteTextOveractiveBladder, {'visible': true});
                break;
            case '7':
                globals.functions.setProperty(section.reminderFootNoteTextAdultOveractiveBladder, {'visible': true});
                break;
            case '8':
                globals.functions.setProperty(section.reminderFootNoteTextPediatricOveractiveBladder, {'visible': true});
                break;
            case '9':
                globals.functions.setProperty(section.reminderFootNoteTextSevereUnderarmSweating, {'visible': true});
                break;
            case '10':
                globals.functions.setProperty(section.reminderFootNoteTextStrabismus, {'visible': true});
                break;
        }
    }
}

/* Prefill Treatment reminders form */
/**
 * bspPrefillTreatmentReminders
 * @name bspPrefillTreatmentReminders
 * @param {object} section
 * @param {scope} globals
 */
function bspPrefillTreatmentReminders(section, globals) {
    bspDecryptAndProcess(function(result) {
        var surveys = (result.arrayOfPatientSurvey && result.arrayOfPatientSurvey.surveys) || [];
        var isReceived = isSurveyChecked(surveys, '4', '1');
        var emailChecked = isSurveyChecked(surveys, '14', '1');
        var phoneChecked = isSurveyChecked(surveys, '6', '14');
        var patientType =  result.patientType || '';
        var ltd = result.patientTherapy && result.patientTherapy[0].diagnosis && result.patientTherapy[0].diagnosis[0].dateofLastTreatment;
        var formatedLtd =  ltd ? bspFormatDate(ltd) : '';
        var indicationId = result.patientTherapy && result.patientTherapy[0].diagnosis && result.patientTherapy[0].diagnosis[0].diagnosisName;
        var treatmentDetails = result.treatmentReminders && result.treatmentReminders.length && result.treatmentReminders[0] || '';
        var treatmentPhoneNumber = result.treatmentReminders && result.treatmentReminders.length && result.treatmentReminders[0].phone || '';
        var editables = section.editableTreatmentReminders;
        globals.functions.setProperty(section.additionalPatientId, {'value': result.additionalPatientId});
        globals.functions.setProperty(section.externalPatientId, {'value': result.externalPatientId});
        globals.functions.setProperty(section.patientId, {'value': result.patientId});
        globals.functions.setProperty(section.patientType, {'value': result.patientType});
        if(formatedLtd) {
            globals.functions.setProperty(editables.dateofLastTreatment, {'value': formatedLtd});
        }
        var treatFrequency = treatmentDetails.frequency || '';
        if (isReceived) {
            globals.functions.setProperty(section.wouldYouLikeToReceiveTreatmentReminders, {'value': '0'});
        } else {
            globals.functions.setProperty(section.wouldYouLikeToReceiveTreatmentReminders, {'value': '1'});
        }
        if (emailChecked && phoneChecked) {
            globals.functions.setProperty(editables.howWouldYouLikeToReceive, {'value': ['0','1']});
            globals.functions.setProperty(editables.treatmentReminderMode, {'value': ['0','1']});
        } else if (emailChecked) {
            globals.functions.setProperty(editables.howWouldYouLikeToReceive, {'value': '0'});
            globals.functions.setProperty(editables.treatmentReminderMode, {'value': '0'});
        } else if (phoneChecked) {
            globals.functions.setProperty(editables.howWouldYouLikeToReceive, {'value': '1'});
            globals.functions.setProperty(editables.treatmentReminderMode, {'value': '1'});
        }
        bspPrefillTRMobileNumber(phoneChecked, treatmentPhoneNumber, editables.smsOptinPanel, result, globals);
        bspTreatmentRemindersIntervals(editables.remindersTimeSpanPanel, indicationId, globals);
        bspTreatmentRemindersFootNote(editables.remindersTimeSpanPanel, indicationId, treatFrequency, globals);
        globals.functions.setProperty(section.formInitStatus, {'value': 'completed'});
    });
}

/**
 * bspSetCampaignsforReminders
 * @name bspSetCampaignsforReminders
 * @param {object} section
 * @param {scope} globals
 */
function bspSetCampaignsforReminders(section, globals) {
    var remindersChoise = section.wouldYouLikeToReceiveTreatmentReminders.$value;
    var remindersType = section.editableTreatmentReminders.howWouldYouLikeToReceive.$value;
    var hiddenRemindersType = section.editableTreatmentReminders.treatmentReminderMode.$value;
    var campaignsPanel = section.campaignsPanel;

    if(remindersChoise === '1'){
        globals.functions.setProperty(campaignsPanel.campaign_2.campaign_2_responsetext,{'value': 'No'});
        globals.functions.setProperty(campaignsPanel.campaign_2.campaign_2_responseid,{'value': '2'});
        if(hiddenRemindersType){
            if(hiddenRemindersType.includes("0")){
                globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responsetext,{'value': 'No'});
                globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responseid,{'value': '2'});
            }
            if(hiddenRemindersType.includes("1")){
                globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responsetext,{'value': 'No'});
                globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responseid,{'value': '16'});
            }
        }
        else{
            globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responsetext,{'value': ''});
            globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responseid,{'value': ''});
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responsetext,{'value': ''});
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responseid,{'value': ''});
        }
    }
    else if(remindersChoise === '0') {
        globals.functions.setProperty(campaignsPanel.campaign_2.campaign_2_responsetext,{'value': 'Yes'});
        globals.functions.setProperty(campaignsPanel.campaign_2.campaign_2_responseid,{'value': '1'});
        if(remindersType.includes("0")) {
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responsetext,{'value': 'Yes'});
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responseid,{'value': '1'});
        }
        else if((hiddenRemindersType && hiddenRemindersType.indexOf("0") > -1) && (remindersType === null || (remindersType && remindersType.indexOf("0") < 0))){
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responsetext,{'value': 'No'});
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responseid,{'value': '2'});
        }
        else {
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responsetext,{'value': ''});
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responseid,{'value': ''});
        }
        if(remindersType.includes("1")) {
            globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responsetext,{'value': 'Yes'});
            globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responseid,{'value': '14'});
        }
        else if((hiddenRemindersType && hiddenRemindersType.indexOf("1") > -1) && (remindersType === null || (remindersType && remindersType.indexOf("1") < 0))) {
            globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responsetext,{'value': 'No'});
            globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responseid,{'value': '16'});
        }
        else {
            globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responsetext,{'value': ''});
            globals.functions.setProperty(campaignsPanel.campaign_1.campaign_1_responseid,{'value': ''});
        }
    }
}


/* Prefill communicationPreference form */
/**
 * bspPrefillCommuPreferenceForm
 * @name bspPrefillCommuPreferenceForm
 * @param {object} section
 * @param {scope} globals
 */
function bspPrefillCommuPreferenceForm(section, globals) {
    bspDecryptAndProcess(function(result) {
        globals.functions.setProperty(section.additionalPatientId, {'value': result.additionalPatientId});
        globals.functions.setProperty(section.externalPatientId, {'value': result.externalPatientId});
        globals.functions.setProperty(section.patientTypeText, {'value': result.patientType});
        var surveys = (result.arrayOfPatientSurvey && result.arrayOfPatientSurvey.surveys) || [];
        var emailChecked = isSurveyChecked(surveys, '16', '1');
        var phoneChecked = isSurveyChecked(surveys, '15', '1');        
        if (emailChecked && phoneChecked) {
            globals.functions.setProperty(section.commPreferences, {'value': ['0','1']});      
        } else if (emailChecked) {
            globals.functions.setProperty(section.commPreferences, {'value': '0'});
        } else if (phoneChecked) {
            globals.functions.setProperty(section.commPreferences, {'value': '1'});
        }
        globals.functions.setProperty(section.mobileNumberPanel, {visible: !!phoneChecked});
        if (result.phone && result.phone.length) {
            var mobile = result.phone.find(function(e) {
                return e.phoneType === 'Mobile';
            }) || '';
            var SMSMobile = result.phone.find(function(e) {
                return e.smsOptin === 'Yes';
            }) || '';
        }
        prefillCommuPreferMobile(section, result, mobile, SMSMobile, globals);    
    });
}

/* Prefill Mobile number in communication preference form */
/**
 * prefillCommuPreferMobile
 * @name prefillCommuPreferMobile
 * @param {object} section
 * @param {object} result
 * @param {object} mobile
 * @param {object} SMSMobile
 * @param {scope} globals
 */
function prefillCommuPreferMobile(section, result, mobile, SMSMobile, globals) {
    if (result.patientType === 'Patient' && result.phone) {
        if (mobile) {
            globals.functions.setProperty(section.mobileNumberPanel.mobilePhoneNumber, {'value': baseFormatPhoneNumber(mobile.phoneNumber)});
            globals.functions.setProperty(section.mobileNumberPanel.mobilePhoneNumber, {readOnly: true});
            if (mobile.smsOptin === 'Yes') {
                globals.functions.setProperty(section.mobileNumberPanel.SMSOptIn, {'value': mobile.smsOptin});
            }
        }
    } else if (result.patientType === 'Caregiver' && result.caregiver[0].phone) {
        var mobileCare = result.caregiver[0].phone.find(function(e) {
            return e.phoneType === 'Mobile';
        }) || '';
        if (mobileCare) {
            globals.functions.setProperty(section.mobileNumberPanel.mobilePhoneNumber, {'value': baseFormatPhoneNumber(mobileCare.phoneNumber)});
            globals.functions.setProperty(section.mobileNumberPanel.mobilePhoneNumber, {readOnly: true});
            if (SMSMobile.smsOptin === 'Yes') {
                globals.functions.setProperty(section.mobileNumberPanel.SMSOptIn, {'value': SMSMobile.smsOptin});
            }
        }
    }
}

/**
 * bspPrefillChangePassword
 * Prefills the Change Password form fields (email and patient type) based on the decrypted data.
 *
 * @name bspPrefillChangePassword
 * @param {object} section - The section object containing the form elements that need to be populated.
 * @param {scope} globals - The global scope for accessing any necessary variables (if applicable).
 */
 function bspPrefillChangePassword(section, globals) {
      decryptResponseGcm('admp_gp').then(function(decryptedData) {
          var result = JSON.parse(decryptedData);
          if (result) {
              var patientTypeResponse = result.patientType || '';
              var surveys = (result.arrayOfPatientSurvey && result.arrayOfPatientSurvey.surveys) || [];
              var prescribedBotox = surveys.length && surveys.find(function(x) {
                  return x.questionId === '1';
              }) || '';
              if (patientTypeResponse == 'Patient' || prescribedBotox.responseId === '2') {
                  globals.functions.setProperty(section.emailPanel.emailTextbox, {'value' : result.email[0].emailAddress});
              } else if (patientTypeResponse == 'Caregiver' && prescribedBotox.responseId === '1') {
                  globals.functions.setProperty(section.emailPanel.emailTextbox, {'value' : result.caregiver[0].email[0].emailAddress});
              } else {
                 globals.functions.setProperty(section.emailPanel.emailTextbox, {'value' : result.email[0].emailAddress});
              }
              globals.functions.setProperty(section.patientTypeText, {'value' : (prescribedBotox && prescribedBotox.responseId === '1') ? 'Patient' : 'Prospect'});
          }
      });
 }

 /**
 * bspPrefillHealthcareProvider
 * Prefills the Healthcare Provider form fields based on the decrypted data
 * @name bspPrefillHealthcareProvider
 * @param {object} section
 * @param {scope} globals
 */
 function bspPrefillHealthcareProvider(section, globals) {
      decryptResponseGcm('admp_gp').then(function(decryptedData) {
          var result = JSON.parse(decryptedData);
          if (result) {
            globals.functions.setProperty(section.patientId, {'value' : result.patientId || ''});
            globals.functions.setProperty(section.additionalPatientId, {'value' : result.additionalPatientId || ''});
            globals.functions.setProperty(section.externalPatientId, {'value' : result.externalPatientId || ''});
            var surveys = (result.arrayOfPatientSurvey && result.arrayOfPatientSurvey.surveys) || [];
            var healthcareProviders = surveys.length && surveys.find(function(x) {
                return x.questionId === '24';
            }) || '';
            globals.functions.setProperty(section.campaignsPanel.campaign_1.campaign_1_responseid, {'value' : healthcareProviders?.responseId || '2'});
            globals.functions.setProperty(section.hiddenHealthcareProvider, {'value' : healthcareProviders?.responseId || '2'});
            var patientType = result.patientType || '';
            var patientEmail = result.email?.[0]?.emailAddress || '';
            var caregiverEmail = result.caregiver?.[0]?.email?.[0]?.emailAddress || '';
            if (patientType == 'Caregiver') {
                globals.functions.setProperty(section.caregiverEmailTextbox, {'value' : caregiverEmail});
            } else {
                globals.functions.setProperty(section.emailTextbox, {'value' : patientEmail});
            }
          }
      });
 }

 /**
   * healthcareProviderModalStatus
   * @name healthcareProviderModalStatus
   * @param {object} section
   * @param {scope} globals
   */
 function healthcareProviderModalStatus(section, globals) {
    if (elementChanged) {
        modalOpen();
        $(".abbv-qPoll #okBtn").click(function() {
            modalClose();
            globals.functions.setProperty(section.healthcareProviderViewpanel, {'visible': true});
            globals.functions.setProperty(section.healthcareProviderEditpanel, {'visible': false});
            elementChanged = false;
            $('.submit.button button').prop('disabled', true);
        });
        $(".abbv-qPoll #cancelBtn").click(function() {
            modalClose();
        });
    } else {
        modalClose();
        globals.functions.setProperty(section.healthcareProviderViewpanel, {'visible': true});
        globals.functions.setProperty(section.healthcareProviderEditpanel, {'visible': false});
        elementChanged = false;
        $('.submit.button button').prop('disabled', true);
    }
  }

 /**
   * handleModalNavigation
   * @name handleModalNavigation
   * @param {object} section
   * @param {scope} globals
   */
 function handleModalNavigation(section, globals) {
       if (elementChanged) {
           modalOpen();
           $(".abbv-qPoll #okBtn").click(function() {
               modalClose();
               if (section.patientTypeText.$value === 'Patient') {
                   window.location.href = window.location.origin + section.patientRedirectPath.$value;
               } else {
                    window.location.href = window.location.origin + section.dashboardRedirectPath.$value;
               }
               elementChanged = false;
           });
           $(".abbv-qPoll #cancelBtn").click(function() {
               modalClose();
           });
       } else {
           if (section.patientTypeText.$value === 'Patient') {
               window.location.href = window.location.origin + section.patientRedirectPath.$value;
           } else {
               window.location.href = window.location.origin + section.dashboardRedirectPath.$value;
           }
           elementChanged = false;
       }
  }

function bspHandleErrorResponse(errorList, globals) {
    baseSubmitReset();
    if (errorList && errorList.length) {
        handleFieldError(errorList, globals);
    } else {
        showGenericErrorByCode(globals, errorList);
    }
}

function bspShowLoader(show) {
    if (show) {
        $('.abbv-animation-loading').remove();
        if ($('.forms-embed').length > 0) {
            $('.forms-embed').prepend('<div class="abbv-animation-loading"></div>');
            $('.forms-embed').addClass('bsp-show');
        } else {
            $('section').prepend('<div class="abbv-animation-loading"></div>');
            $('section').addClass('bsp-show');
        }

    } else {
        $('.abbv-animation-loading').remove();
        if ($('.forms-embed').length > 0) {
        $('.forms-embed').removeClass('bsp-show');
        }
        else{
            $('section').removeAttr('class');
        }
    }
}

function getDropdownValue(dropdownElement) {
    return dropdownElement.val();
}

/**
   * baseRestrictIndividualNpiCharacters
   * @name baseRestrictIndividualNpiCharacters
   * @param {string} targetClass
   */
function baseRestrictIndividualNpiCharacters(targetClass) {
    var targetElm = $('.' + targetClass + ' input');
    $(targetElm).on('propertychange input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
}

/**
   * bspUpdateIndicationValues
   * @name bspUpdateIndicationValues
   * @param {object} section
   * @param {scope} globals
   */
 function bspUpdateIndicationValues(section, globals) {
    const indicationCookieValue = baseGetCookieValue("indicationId");
    const $pedCond = $('.ped-cond');
    const $condCheckLabel = $('.cond-check label');
    const $indicationList = $('.indicationList');
    const indicationMap = {
        "2": { ped: '.ps', cond: '.as' },
        "8": { ped: '.pob', cond: '.aob' }
    };

    if (indicationMap[indicationCookieValue]) {
        const { ped, cond } = indicationMap[indicationCookieValue];
        $pedCond.text($indicationList.find(ped).text());
        $condCheckLabel.text($indicationList.find(cond).text());
        $condCheckLabel.attr('data-indication', indicationCookieValue);
    }
  }

  /**
   * bspIndicationUpdate
   * @name bspIndicationUpdate
   * @param {object} section
   * @param {scope} globals
   */
 function bspIndicationUpdate(section, globals) {
    const $diagnosisInput = $('input[name="diagnosisName"]');
    $('.cond-check input').on('click', function () {
        const indication = $(this).siblings('label').data('indication');
        const valueMap = { 2: 1, 8: 7 };
        var campaignsPanel = section.campaignsPanel;
        if (valueMap[indication]) {
            $diagnosisInput.val(valueMap[indication]);
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responsetext,{'value': 'No'});
            globals.functions.setProperty(campaignsPanel.campaign_3.campaign_3_responseid,{'value': '0'});
        }
    });
  }
var bspFileUpload = (function() {
    return {
        /**
         * Main entry point for handling file upload actions in Claims.
         * Decides whether the action is ADD or DELETE depending on clicked element.
         * Both flows funnel into reconcile(), which mirrors the repeating
         * filesPanel to the widget's current attachments list by index.
         *
         * @param {object} event - The DOM event triggered in the file upload control.
         */
        uploadAttachmentsForClaims: function(event) {
            var parentPanel = guideBridge.resolveNode(
                "$form.guideRootPanel.newClaim.fileUploadPanel.filesPanel"
            );

            if (!parentPanel) {
                console.error("filesPanel not found!");
                return;
            }

            if ($(event.target).closest(".cmp-adaptiveform-fileinput__filedelete").length) {
                this.handleDelete(parentPanel);
            } else {
                this.handleAdd(parentPanel);
            }
        },
        onAttachDocumentsClick: function () {
            if (this.isUploadDocumentsPanelActive()) {
                this.disableContinueButton();
                bspShowLoader(true);
            }

            if (this.isReviewPanelActive()) {
                this.disableSubmitButton();
                bspShowLoader(true);
            }
        },
        isUploadDocumentsPanelActive: function () {
            var panel = $('.upload-documents-panel');
            return panel.length && panel.attr('data-cmp-visible') === 'true';
        },
        getContinueButton: function () {
            return $('.continue-button');
        },
        disableContinueButton: function () {
            var btn = this.getContinueButton();
            if (btn.length) {
                btn.prop('disabled', true)
                   .addClass('is-disabled');
            }
        },
        enableContinueButton: function () {
            var btn = this.getContinueButton();
            if (btn.length) {
                btn.prop('disabled', false)
                   .removeClass('is-disabled');
            }
        },
        isReviewPanelActive: function () {
            var panel = $('.review-panel');
            return panel.length && panel.attr('data-cmp-visible') === 'true';
        },
        getSubmitButton: function () {
            return $('.submit-button');
        },
        disableSubmitButton: function () {
            var submitBtn = this.getSubmitButton();
            if (submitBtn.length) {
                submitBtn.prop('disabled', true)
                        .addClass('is-disabled');
            }
        },
        enableSubmitButton: function () {
            var submitBtn = this.getSubmitButton();
            if (submitBtn.length) {
                submitBtn.prop('disabled', false)
                        .removeClass('is-disabled');
            }
        },

        /**
         * ADD flow: disable the action button + show loader, then reconcile the
         * panel to the widget's attachments (which now include the new file).
         */
        handleAdd: function(parentPanel) {
            this.onAttachDocumentsClick();
            this.reconcile(parentPanel);
        },

        /**
         * DELETE flow: disable the action button + show loader, then reconcile on
         * the next tick. The setTimeout lets AEM's own delete handler update the
         * attachments model first, so reconcile re-mirrors the shortened list and
         * removes the correct instance (even for duplicate filenames).
         */
        handleDelete: function(parentPanel) {
            var self = this;
            this.onAttachDocumentsClick();
            setTimeout(function() {
                self.reconcile(parentPanel);
            }, 0);
        },

        /**
         * Mirror the repeating filesPanel to result.data.attachments by index:
         * instance i holds attachments[i]. attachments is the single source of
         * truth (the widget's current files), so duplicate names and deletes stay
         * consistent with the submitted payload.
         */
        reconcile: function(parentPanel) {
            var self = this;

            guideBridge.getFormDataObject({
                success: function(result) {
                    if (self.isUploadDocumentsPanelActive()) {
                        self.enableContinueButton();
                    } else if (self.isReviewPanelActive()) {
                        self.enableSubmitButton();
                    }
                    bspShowLoader(false);

                    var attachments = (result && result.data && result.data.attachments) || [];
                    var count = attachments.length;

                    self.ensureInstanceCount(parentPanel, count);

                    var instances = parentPanel.items || [];

                    // No files: keep the single retained instance but blank it out.
                    if (count === 0) {
                        var emptyFields = self.getTemplateFields(instances[0]);
                        if (emptyFields && emptyFields.type && emptyFields.content) {
                            emptyFields.type.value = "";
                            emptyFields.content.value = "";
                        }
                        return;
                    }

                    for (var i = 0; i < count; i++) {
                        var fields = self.getTemplateFields(instances[i]);
                        if (!fields || !fields.type || !fields.content) {
                            console.error("Template fields missing at index:", i);
                            continue;
                        }

                        var fileName = attachments[i].name;
                        var data = attachments[i].data || "";
                        // attachments[i].data is a data: URL - strip the prefix.
                        var base64 = data.indexOf(",") >= 0 ? data.split(",")[1] : data;

                        if (!base64) {
                            console.error("Invalid base64 data for:", fileName);
                            continue;
                        }

                        fields.type.value = fileName;
                        fields.content.value = base64;
                    }
                }
            });
        },

        /**
         * Resize the repeating panel to hold exactly `count` instances, while
         * always keeping at least one instance (a repeating panel cannot be empty).
         * addItem()/removeItem() update panel.items synchronously.
         */
        ensureInstanceCount: function(parentPanel, count) {
            if (!parentPanel) {
                return;
            }

            var target = count > 0 ? count : 1;
            var items = parentPanel.items || [];

            while (items.length < target) {
                if (!parentPanel.addItem) {
                    console.error("addItem() missing");
                    return;
                }
                var beforeAdd = items.length;
                parentPanel.addItem({ type: "addItem" });
                items = parentPanel.items || [];
                if (items.length <= beforeAdd) {
                    console.error("addItem did not add an instance; stopping at", items.length);
                    return;
                }
            }

            while (items.length > target) {
                if (!parentPanel.removeItem) {
                    console.error("removeItem() missing");
                    return;
                }
                var beforeRemove = items.length;
                parentPanel.removeItem({ type: "removeItem", payload: items.length - 1 });
                items = parentPanel.items || [];
                if (items.length >= beforeRemove) {
                    console.error("removeItem did not remove an instance; stopping at", items.length);
                    return;
                }
            }
        },

        /**
         * Get type/content fields from an instance's fileItemTemplate child.
         */
        getTemplateFields: function(instance) {
            if (!instance || !instance.items) {
                return null;
            }

            var children = instance.items || [];
            var template = null;

            for (var i = 0; i < children.length; i++) {
                if (children[i].name === "fileItemTemplate") {
                    template = children[i];
                    break;
                }
            }

            if (!template || !template.items) {
                return null;
            }

            var tChildren = template.items;
            var fields = {
                type: null,
                content: null
            };

            for (var j = 0; j < tChildren.length; j++) {
                if (tChildren[j].name === "type") {
                    fields.type = tChildren[j];
                }
                if (tChildren[j].name === "content") {
                    fields.content = tChildren[j];
                }
            }

            return fields;
        }
    }
})();

/* File Upload (Add) */
$(document).on(
    "change",
    ".bsp-file-upload input.cmp-adaptiveform-fileinput__widget[type='file']",
    function (event) {
        bspFileUpload.uploadAttachmentsForClaims(event);
    }
);

/* File Delete */
$(document).on(
    "click",
    ".cmp-adaptiveform-fileinput__filedelete",
    function (event) {
        if($(".bsp-file-upload").length === 0){
            return;
        }
        bspFileUpload.uploadAttachmentsForClaims(event);
    }
);
/* jshint esversion: 11 */
/* globals
 AbbViePageInfo, opr, safari
*/

//Don't use let/const for global definitions here b/c this code is also in preloadframeworkinlineJS.html

var cookieObj = (function() {
	//NOTE: Unlikely that we have cookie names/values with spaces or special characters, but encode/decode just in case
	//NOTE: Chrome now sets a max cookie age of 400, even if a larger value is passed

	return {
		init: function() {
			// no longer needed - left for back-compat (forms code)
		},

		/**
		 * Retrieve a cookie value
		 * @param {String} name cookie name
		 * @returns {String} cookie value, or undefined if not found
		 */
		getCookie: function(name) {
			if (!name) {
				return undefined;
			}

			//This line fails, when it's in a script tag in preloadframworkinlineJS.html, even when commented out!! 
			//let value = document.cookie.split('; ').find((c) => c.startsWith(`${encodeURIComponent(name)}=`))?.split('=')[1];
			name = encodeURIComponent(name);
			let value = document.cookie.split('; ').find((c) => c.startsWith(name + '='));

			return value ? decodeURIComponent(value.split('=')[1]) : undefined; 
		},

		/**
		 * Set a cookie value on root path
		 * @param {String} name cookie name 
		 * @param {String} value cookie value
		 * @param {Number} [days=0] number of days for cookie to persist. 0 (falsy value) sets session cookie. Negative value deletes cookie.
		 * @param {Boolean} [notSecure=false] true to set unsecure cookie (not advised)
		 */
		createCookie: function(name, value, days, notSecure) {
			let expires;
			if (days) {
				let date = new Date();
				date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
				expires = `; expires=${date.toGMTString()}`;
			} else {
				expires = '';  //session cookie
			}

			//This line fails, when it's in a script tag in preloadframworkinlineJS.html, even when commented out!! 
	        //document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)} ${expires}; path=/; ${notSecure === true ? '' : 'secure'}`;

			document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + expires + "; path=/;" + (notSecure===true ? "" : "secure");

			//Should evaluate any cookies explicity set to unsecure
			if (notSecure === true) {
				console.log('cookieObj: wrote unsecure cookie - name=' + name);
			}
		},

		/**
		 * Delete a cookie
		 * @param {String} name cookie name
		 */
		deleteCookie: function(name) {
			this.createCookie(name, '', -1);
		}
	};
})();

var urlObj = (function() {
	var queryVars = {};
	var queryVarsU = {};
	return {
		init: function(){
			urlObj.analzeQuery();
		},
		analzeQuery: function(){
			var qString = window.location.search.split('?')[1];
			if(qString != undefined){
				var temp = qString.split('&');
				for(let i = 0; i < temp.length; i++){
					let tempSplit = temp[i].split('=');
					queryVars[tempSplit[0]] = tempSplit[1];
					queryVarsU[tempSplit[0].toUpperCase()] = tempSplit[1];
				}
			}
		},
		getParam: function(key, caseSensative){
			caseSensative = caseSensative == undefined ? true : caseSensative;
			let val;
			if(caseSensative){ val = decodeURIComponent(queryVars[encodeURIComponent(key)]);}
			else { val = decodeURIComponent(queryVarsU[encodeURIComponent(key.toUpperCase())]);}
			return val;
		},
		getParamsObj: function (){
			return queryVars;
		},
		getParamsObjU: function (){
			return queryVarsU;
		},
		printObj: function(){
			console.log(queryVars);
			console.log(queryVarsU);
		}
	};
})();

var campaignTracking = (function() {
	var idTables;
	var gpf_payload = {};
	var sa_payload = {
		"CampaignMasterId":"",
		"CompleteDate":null,
		"ConsumerId":"",
		"IndividualId":"",
		"AssessmentQuestion": [{
			"QuestionId":"",
			"QuestionOptions":[{
				"OptionId":"",
				"ResponseText":""
			}]
		}],
		"OtherInformation":{}
	};
	var questionLookupReq = false;
	var saveReady = false;
	return {
		init: function(){
			idTables = AbbViePageInfo.campaignConfig;
      		AbbViePageInfo.campaignTracking = {};
			if(campaignTracking.getIndividualID()){
				// console.log('-- Individual ID Found --');
				AbbViePageInfo.campaignTracking.individualID = sa_payload.IndividualId;
				if(campaignTracking.getCampaignMasterID()){
					// console.log('-- Campaign Master ID Found --');
					AbbViePageInfo.campaignTracking.campaignMasterId = sa_payload.CampaignMasterId;
					if(campaignTracking.getOptionID()){
						// console.log('-- Option ID Found --');
						if(campaignTracking.getQuestionID()){
							// console.log('-- Question ID Found --');
							saveReady = true;
						}
						campaignTracking.getAdditionalInfo();
					}
				}
			}
			if (saveReady) {
				campaignTracking.saveAssessment();
			}
		},
		getIndividualID: function (){
			let haveInfo = false;
			if(urlObj.getParam('s_fid',false) != 'undefined'){
				gpf_payload.Source = "Intouch";
				gpf_payload.FulfillmentID = urlObj.getParam('s_fid',false);
				haveInfo = true;
				// return true;
			} else if (urlObj.getParam('h_fid',false) != 'undefined'){
				gpf_payload.Source = "Epsilon";
				gpf_payload.FulfillmentID = urlObj.getParam('h_fid',false);
				haveInfo = true;
				// return true;
			} else if (urlObj.getParam('fid') != 'undefined'){
				gpf_payload.Source = "Epsilon";
				gpf_payload.FulfillmentID = urlObj.getParam('fid',false);
				haveInfo = true;
				// return true;
			} else {
				console.log('missing fid variant');
				// return false;
			}
			if(haveInfo){
				//Ajax call to get individual ID
				let url = AbbViePageInfo.apiEndPoints.getPatientFullfilment;
				let successState = false;
				ajaxCall(url, "POST", JSON.stringify(gpf_payload), gpfSuccess, gpfFail);
				//Success
				function gpfSuccess(data){
					//Set to sa_payload
					if(data.ContentResult && data.ContentResult.IndividualId){
						var id = data.ContentResult.IndividualId;
						sa_payload.IndividualId = id;
						sessionStorage.setItem('IndividualId',id);
						//Write cookie
						successState = true;
					}
				}
				//Fail
				function gpfFail(jqXHR, textStatus, errorThrown){
					//return false
					console.log('Get Patient Fullfillment Fail');
					successState = false;
				}
				return successState;
			} else {
				return false;
			}
		},
		getCampaignMasterID: function(){
			if(urlObj.getParam('mcid',false) != 'undefined'){
				sa_payload.CampaignMasterId = urlObj.getParam('mcid',false);
				return true;
			} else if (urlObj.getParam('em_id') != 'undefined'){
				sa_payload.CampaignMasterId = idTables.emids[urlObj.getParam('em_id')];
				questionLookupReq = true;
				return true;
			} else if (urlObj.getParam('sid') != 'undefined'){
				sa_payload.CampaignMasterId = idTables.sids[urlObj.getParam('sid')];
				questionLookupReq = true;
				return true;
			} else if (urlObj.getParam('qID') != 'undefined'){
				sa_payload.CampaignMasterId = idTables.qids[urlObj.getParam('qID')];
				questionLookupReq = true;
				return true;
			} else if (urlObj.getParam('eid') != 'undefined'){
				sa_payload.CampaignMasterId = idTables.eids[urlObj.getParam('eid')];
				questionLookupReq = true;
				return true;
			} else {
				console.log('missing master campaign id in query or corresponding id');
				return false;
			}
		},
		getQuestionID: function(){
			if(questionLookupReq){
				// console.log('Question Id lookup Required');
				let successState = false;
				let cmi_query = "?CampaignMasterId="+sa_payload.CampaignMasterId;
				let url = AbbViePageInfo.apiEndPoints.getAssessment+cmi_query;
				ajaxCall(url, 'GET', '', getAssessmentSuccess, getAssessmentFail);
				function getAssessmentSuccess(data){
					// console.log('getAssessmentSuccess');
					if(data.IsStatusSuccessful){
						var matchOption = sa_payload.AssessmentQuestion[0].QuestionOptions[0].OptionId;
						var questionList = data.ContentResult.AssessmentQuestion;
						var matchedQuestionID = campaignTracking.reverseLookup(questionList, matchOption);
						if(matchedQuestionID != undefined){
							sa_payload.AssessmentQuestion[0].QuestionId = matchedQuestionID;
							successState = true;
							// console.log('reverse lookup found question id');
						} else { console.log('no option id matching in campaign');}
					} else {
						console.warn('getAssessment status successful = false');
					}
				}
				function getAssessmentFail(jqXHR, textStatus, errorThrown){console.log('getAssessmentFail');}
				return successState;
			} else {
				if(urlObj.getParam('qid') != 'undefined'){
					sa_payload.AssessmentQuestion[0].QuestionId = urlObj.getParam('qid');
					return true;
				}
				else {
					console.log('missing question id in query or corresponding id');
					return false;
				}
			}
		},
		getOptionID: function(){
			if(urlObj.getParam('oid',false) != 'undefined'){
				sa_payload.AssessmentQuestion[0].QuestionOptions[0].OptionId = urlObj.getParam('oid',false);
				return true;
			} else if (urlObj.getParam('eid') != 'undefined'){
				if(urlObj.getParam('qid') != 'undefined'){
					let lookup = urlObj.getParam('eid') + urlObj.getParam('qid');
					if(idTables.optionids[lookup] != undefined){
						sa_payload.AssessmentQuestion[0].QuestionOptions[0].OptionId = idTables.optionids[lookup];
						return true;
					} else {
						console.warn('eid + qid no option id to match');
						return false;
					}
				}
				console.log('missing qid for looking up eid + qid');
			} else if (urlObj.getParam('q1',false) != 'undefined'){
				sa_payload.AssessmentQuestion[0].QuestionOptions[0].OptionId = urlObj.getParam('q1',false);
				return true;
			} else {
				console.log('missing option id in query or corresponding id');
				return false;
			}
		},
		getAdditionalInfo: function(){
			if (urlObj.getParam('cid',false) != 'undefined'){
				sa_payload.OtherInformation.cid = urlObj.getParam('cid',false);
				return true;
			} else if (urlObj.getParam('s_mcid',false) != 'undefined'){
				sa_payload.OtherInformation.cid = urlObj.getParam('s_mcid',false);
				return true;
			}
			if(urlObj.getParam('ep_ind',false) != 'undefined'){
				sa_payload.OtherInformation.cid = urlObj.getParam('cid',false);
				return true;
			}
		},
		reverseLookup: function(data, optionID){
			for(let i = 0; i < data.length; i++){
				let optionList = data[i].QuestionOption;
				let tempQuestion = data[i].QuestionId;
				for (let k = 0; k < optionList.length; k++){
					if(optionList[k].OptionId.toUpperCase() == optionID.toUpperCase()){
						return tempQuestion;
					}
				}
			}
		},
		saveAssessment: function(){
			let url = AbbViePageInfo.apiEndPoints.saveAssessment;
			ajaxCall(url, "POST", JSON.stringify(sa_payload), saveAssessmentSuccess, saveAssessmentFail);
			function saveAssessmentSuccess(){
				console.log("Save Asessement Success");
			}
			function saveAssessmentFail(jqXHR, textStatus, errorThrown){
				console.error("Save Assessment Fail");
			}
		},
		printPayloads: function(){
			console.log(gpf_payload);
			console.log(sa_payload);
		}
	};
})();


function setHeaders(url, xhr){
	xhr.setRequestHeader("content-type","application/json");
	// If call is a save assessment call
	if(AbbViePageInfo.apiEndPoints.saveAssessment === url){
		let acMcIdCookie = cookieObj.getCookie('ac_mcid');
		if(acMcIdCookie != undefined){
			xhr.setRequestHeader("MId",acMcIdCookie);
		}
	}
}
function ajaxCall(url, type, payload, successCallback, failedCallback, async, dataType){
    var xhr = new XMLHttpRequest();
    xhr.open(type, url, async === true);
    setHeaders(url, xhr);

    function runCallbacks(cb, data){
        if(!cb) return;
        if (Array.isArray(cb)){
            for (var i = 0; i < cb.length; i++){
                cb[i](data, xhr.statusText, xhr);
            }
        } else {
            cb(data, xhr.statusText, xhr);
        }
    }

    xhr.addEventListener("error", function () {
        runCallbacks(failedCallback, undefined);
    });

    xhr.onreadystatechange = function(){
        if (xhr.readyState !== 4) return;

        if (xhr.status !== 200){
            runCallbacks(failedCallback, undefined);
            return;
        }

        var data = xhr.responseText;
        var ct = xhr.getResponseHeader('content-type') || '';
        if (ct.includes("application/json")){
            try {
                data = JSON.parse(xhr.responseText);
            } catch(e){
                // Leave data as plain text on parse failure
            }
        }
        runCallbacks(successCallback, data);
    };

    xhr.send(payload ? payload : null);
}
function addWindowLoad(func) {
	var oldonload = window.onload;
	if (typeof window.onload != 'function') {
		window.onload = func;
	}
	else {
		window.onload = function() {
			if (oldonload) {
				oldonload();
			}
			func();
		};
	}
  }

var postLoadActions = (function() {
	var pageLoadQueue = [];
	var waitFlags = 0;
	var pageLoadImportance = [
		"isi",
		"modal-once",
		"modal-always",
		"modal-indication",
		"modal-hash",
		"ftvid",
		"pageScroll"
	];

	return {
		addPageLoadStack: function(func,type) {
			let priority = pageLoadImportance.indexOf(type);
			let newFunc = {
				"priority" : priority,
				"func" : func
			};
			if (!pageLoadQueue.length) {
				pageLoadQueue.push(newFunc);
			} else {
				if(!postLoadActions.checkExistence(type)){
					let insertIndex = pageLoadQueue.length;
					for (let i = 0; i < pageLoadQueue.length; i++) {
						if(priority > pageLoadQueue[i].priority){
							insertIndex = i;
							break;
						}
					}
					pageLoadQueue.splice(insertIndex, 0, newFunc);
				}
			}
		},
		addWaitFlag: function(){waitFlags++; },
		removeWaitFlag: function(){waitFlags--;},
		isWaiting: function(){return waitFlags != 0;},
		isReady: function(){return waitFlags == 0;},
		pop: function(){
			if (pageLoadQueue.length) {
				let popped = pageLoadQueue.pop();
				popped.func();
			} else {
				return;
			}
		},
		checkExistence : function(type){
			let priority = pageLoadImportance.indexOf(type);
			let isAvailable = false;
			if (pageLoadQueue.length) {
				for (let i = 0; i < pageLoadQueue.length; i++) {
					if(priority == pageLoadQueue[i].priority){
						isAvailable = true;
						break;
					}
				}
			}
			return isAvailable;
		},
		printObj: function(){
			console.log(pageLoadQueue);
		}
	};
})();
/*Generate Email with Attachment function*/
function generateEmailWithAttachments(emailParams, successCallbackFunction, failureCallbackFunction) {
    var indicationName = baseGetCookieValue('indicationName');
    var finalIndicationPath = '';
    var globalISIPath = '';
    var indicationPath = '';
    if (window.parent.AbbViePageInfo.indicationEndPoints) {
        indicationPath = window.parent.AbbViePageInfo.indicationEndPoints.inlineUse;
        finalIndicationPath = indicationPath.substring(0, indicationPath.lastIndexOf('{{'));
        globalISIPath = indicationName != '' ? finalIndicationPath + indicationName : finalIndicationPath;
        finalIndicationPath += (indicationName || 'generic-indication');
    }
    if (emailParams.emailName == 'ddg') {
        var formData = new FormData();
        if (emailParams.fileAttachment) {
            for (var i = 0; i < emailParams.fileAttachment.length; i++) {
                var file = emailParams.fileAttachment[i];
                formData.append('file[' + i + ']', file);
            }
        }
        formData.append("quizddg", JSON.stringify(emailParams.result));
        formData.append("emailAddress", emailParams.emailAddress);
        formData.append("emailName", emailParams.emailName);
        formData.append("pagePath", emailParams.pagePath);
        formData.append("finalIndicationPath", finalIndicationPath);
        formData.append("globalISIPath", globalISIPath);
        formData.append("totalImpactTimeInDays", emailParams.totalImpactTimeInDays);
        formData.append("totalImpactTimeInHrs", emailParams.totalImpactTimeInHrs);
        $.ajax({
            url: '/bin/abbvieforms/abbvieemail',
            method: 'post',
            data: formData,
            async: emailParams.asyncType,
            processData: false,
            contentType: false
        })
            .done(function (response) {
                if (response) {
                    var emailResponse = JSON.parse(response);
                    if (analyticspayload.validPayload) {
                        admp_analytics_functions.setFormStepName('Submit');
                        analyticspayload.getFormCompletePayload();
                    } else {
                        analyticsFormSubmitEvent();
                    }
                    var status = emailResponse.status;
                    if (status) {
                        console.log("Email Sent Successfully");
                        successCallbackFunction(response);
                    }
                }
            })
            .fail(function (error) {
                console.error('Email Not Sent');
                failureCallbackFunction(error);
            });
    }
}
/**
 * baseCVDSubmit
 * @name baseCVDSubmit
 * @param {object} root 
 * @param {object} globals
 */
function baseCVDSubmit(root,globals) {

    var dataCofigAttributeValue = $('.abbv-form-fileupload').data('config');

    var files = window[dataCofigAttributeValue].filesToUpload;
    var globaldata = globals.form.ddgQuiz.name;
    var fileData = $('input[name="fileName"]').val();

    if (!$('.file-status-message').hasClass('file-invalid')) {
        var fileNames = '';
        $('.file-status').each(function () {
            if ($(this).find('.file-status-message span').text() === 'Done') {
                if (fileNames) {
                    fileNames += ',';
                }
                fileNames += $(this).find('.fileinfo-name').text();
            }
        });

      fileData = fileNames;
    }

    passDDGQuestions(globals);
    var errors = globals.functions.validate();
    var emailAndCaptchaResult =
        (errors.length === 0) ||
        (errors.length === 1 && errors[0].fieldName && errors[0].fieldName.includes('recaptcha'));

    if (emailAndCaptchaResult && !$('.tempPath .file-status .file-invalid').length) {
        var userEmailAdd = $(".email-address").find('input').val();
        var userEmailIdentifier = $('input[name="emailIdentifier"]').val();
        var sharedEmailAdd = $('input[name="sharedEmailAddress"]').val();
        var sharedEmailIdentifier = $('input[name="sharedEmailIdentifier"]').val();
        var fileAttachments = files;
        var pagePath = window.parent.AbbViePageInfo ? window.parent.AbbViePageInfo.pagepath : '';

        var generateCVDPayload = function (emailAdd, pageUri, status, emailIdentifier) {
            finalPayload.type1 = JSON.stringify(updatePayload(ddgType1, status));
            finalPayload.type2 = ddgType2;
            finalPayload.totalTimeDays = totalImpactTimeInDays;
            finalPayload.totalTimeHours = totalImpactTimeInHrs;
            finalPayload.emailAddress = emailAdd || '';
            finalPayload.pagePath = pageUri || '';
            finalPayload.emailIdentifier = emailIdentifier || '';
        }

        generateCVDPayload(sharedEmailAdd, pagePath, false, sharedEmailIdentifier);

        var sharedEmailParams = {
            emailAddress: sharedEmailAdd,
            result: finalPayload,
            emailName: 'ddg',
            pagePath: pagePath,
            totalImpactTimeInDays: totalImpactTimeInDays,
            totalImpactTimeInHrs: totalImpactTimeInHrs,
            asyncType: true,
            fileAttachment: fileAttachments
        };

        var cvdEmailSuccess = function (response) {
                redirectToThankYouPage(window.abbviecloudforms.core.formProperties.thankyoupageurl);
            };
        var cvdFailure = function (error) {
            console.error("cvd email failure");
        };

        var cvdSharedEmailSuccess = function (response) {
            generateCVDPayload(userEmailAdd, pagePath, false, userEmailIdentifier);
            var userEmailParams = {
                emailAddress: userEmailAdd,
                result: finalPayload,
                emailName: 'ddg',
                pagePath: pagePath,
                totalImpactTimeInDays: totalImpactTimeInDays,
                totalImpactTimeInHrs: totalImpactTimeInHrs,
                asyncType: true
            };
            generateEmailWithAttachments(userEmailParams, cvdEmailSuccess, cvdFailure);
        };

        generateEmailWithAttachments(sharedEmailParams, cvdSharedEmailSuccess, cvdFailure);

    } else if (emailAndCaptchaResult && $('.tempPath .file-status .file-invalid').length) {
        var errorPanelItem = $('.abbv-form-fileupload').offset().top;
        $('html, body', window.parent.document).animate({
            scrollTop: (errorPanelItem)
        }, 350);
    }
}

(function () {         
    const $input = $('input[name="telephone"]');
    $input.on('input', function () {
      const newVal = this.value.replace(/[^0-9+\- ()]/g, '');
       if (newVal !== this.value) this.value = newVal;
    });
  })();
/**
 * decodeHtmlEntities
 * @name decodeHtmlEntities
 * @param {string} str 
 * @returns {string}
 */
function decodeHtmlEntities(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
}

/**
 * @name collapseAccordionItem
 * @description Collapse accordion items on page load
 */
function collapseAccordionItem() {
    let $items = $('.cmp-accordion__item');
    $items.removeAttr('data-cmp-expanded');
    $items.find('.cmp-accordion__button').removeClass('cmp-accordion__button--expanded');
    $items.find('.cmp-accordion__button').attr('aria-expanded', 'false');
    $items.find('.cmp-accordion__panel').addClass('cmp-accordion__panel--hidden');
    $items.find('.cmp-accordion__panel').removeClass('cmp-accordion__panel--expanded');
    $items.find('.cmp-accordion__panel').attr('aria-hidden', 'true');
}

/**
 * maxedgeEnrollmentPrefill
 * @name maxedgeEnrollmentPrefill
 * @param {object} section
 * @param {scope} globals
 */
function maxedgeEnrollmentPrefill(section, globals) {
    decryptResponseGcm('admp_tpd').then(function (decryptedData) {
        var decryptedDataJson = JSON.parse(decryptedData);
        if (decryptedDataJson) {
            if (decryptedDataJson.status == 'SUCCESS') {
                const content = decryptedDataJson.content || {};
                const practice = content.practice || {};
                const roleObject = practice.role || {};
                const role = roleObject.code || '';
                const decodedRole = decodeURIComponent(escape(role));
                const maxedgeUser = practice.maxedgeUser || '';
                const programName = practice.programs && practice.programs[0] && practice.programs[0].program;
                // Match role variations such as: Physician’s Assistant, Physician's Assistant, Physician Assistant, Nurse Practitioner
                var eligibleRolePattern = /^(?:Physician(?:['’]s)? Assistant|Nurse Practitioner)$/i;
                var isEligibleRole = eligibleRolePattern.test(decodedRole.trim().replace(/\s+/g, ' '));
                if (!isEligibleRole) {
                    window.location.href = '/dashboard';
                }
                var isExistingMaxedgeUser = String(maxedgeUser).toLowerCase() === 'in' && String(programName).toLowerCase() === 'maxedge';
                globals.functions.setProperty(section.maxEdgeEnrollmentPanel, { visible: !isExistingMaxedgeUser });
                globals.functions.setProperty(section.thankyouPanel,{ visible: isExistingMaxedgeUser });
                if (isExistingMaxedgeUser) {
                    var maxEdgeProfileSection = section.thankyouPanel.maxEdgeUpdateProfile.guideRootPanel;
                    var maxEdgeProgram = practice.programs[0];
                    var mailingAddress = maxEdgeProgram.mailingAddress || {};
                    var indications = maxEdgeProgram.indications || [];
                    var maxEdgeResourceSection = section.thankyouPanel.maxEdgeResources;
                    globals.functions.setProperty(maxEdgeResourceSection.adultOveractiveBladder, { visible: indications.includes('Adult Overactive Bladder') });
                    globals.functions.setProperty(maxEdgeResourceSection.adultSpasticity, { visible: indications.includes('Adult Spasticity') });
                    globals.functions.setProperty(maxEdgeResourceSection.cervicalDystonia, { visible: indications.includes('Cervical Dystonia') });
                    globals.functions.setProperty(maxEdgeResourceSection.chronicMigraine, { visible: indications.includes('Chronic Migraine') });
                    globals.functions.setProperty(maxEdgeProfileSection.Indications, {'value' : maxEdgeProgram.indications});
                    globals.functions.setProperty(maxEdgeProfileSection.personalMailingAddress, {'value' : decodeHtmlEntities(mailingAddress.addressLine1)});
                    globals.functions.setProperty(maxEdgeProfileSection.phoneNumber, {'value' : maxEdgeProgram.phoneNumber});
                    globals.functions.setProperty(maxEdgeProfileSection.cityTextbox, {'value' : decodeHtmlEntities(mailingAddress.city)});
                    globals.functions.setProperty(maxEdgeProfileSection.stateDropdown, {'value' : mailingAddress.state});
                    globals.functions.setProperty(maxEdgeProfileSection.zipCodeTextbox, {'value' : mailingAddress.zipCode});
                    setTimeout(function () {
                        collapseAccordionItem();
                    }, 500);
                }
            }
        }
    });
}

/**
 * Botoxone Maxedge Enrollment update profile
 * botoxoneMaxedgeEnrollmentSuccessHandler
 * @name maxedgeEnrollmentSuccessHandler
 * @param {scope} globals
 */
function maxedgeEnrollmentSuccessHandler(globals) {
    $('.submit.button button').prop('disabled', false);
    setDraftIdToBlank(globals);
    onSubmitCompleteAnalytics(globals);
    localStorage.removeItem('admp_tpd');
    deleteCookie('admp_login_token');
    baseReloadPage();
}