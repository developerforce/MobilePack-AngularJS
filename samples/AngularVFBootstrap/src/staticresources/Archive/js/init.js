/**
 * This initializes AngularJS app. Place this file BEFORE app.js (where your actual app is located).
 */
//var app = angular.module('AngularSFDemo', ['AngularForce', 'AngularForceObjectFactory', 'Contact', 'ui.bootstrap.dropdownToggle']);
//app.constant('SFConfig', getSFConfig());

var app = angular.module('AngularSFDemo', ['AngularForce', 'AngularForceObjectFactory', 'Contact', 'ui.bootstrap.dropdownToggle']);
var SFConfig = getSFConfig();

SFConfig.maxListSize = 25;
app.constant('SFConfig', SFConfig);

function initApp(options, forcetkClient) {
    options = options || {};
    options.loginUrl = SFConfig.sfLoginURL;
    options.clientId = SFConfig.consumerKey;
    options.apiVersion = 'v27.0';
    options.userAgent = 'SalesforceMobileUI/alpha';
    options.proxyUrl = options.proxyUrl || SFConfig.proxyUrl;

    //In VF, you should get sessionId and use that as accessToken while initializing forcetk(Force.init)
    if (SFConfig.sessionId) {
        options.accessToken = SFConfig.sessionId;
    }

    //Init force
    Force.init(options, options.apiVersion, forcetkClient);
   // SFConfig.client = Force.forcetkClient;


    //sforce.connection.init(options.accessToken, options.instanceUrl + '/services/Soap/u/' + options.apiVersion, options.useProxy);
    if (navigator.smartstore) {
        SFConfig.dataStore = new Force.StoreCache('sobjects', [
            {path: 'Name', type: 'string'},
            {path: 'attributes.type', type: 'string'}
            ], 'Id');

        SFConfig.dataStore.init();
    }
}

//mockStore.useSessionStorage();

//Uncomment below and set accessToken(= sessionId), instanceUrl and proxyUrl to test smartstore (mock version - coz real smartstore is part of cordova)
// inside the browser
//initApp({
//    accessToken: '00Di0000000JEm3!AQ4AQLnaKs7PPHaRd0xjvJwJkf6O.9R7ECpU5mndDb1DwYsoxhMDrCyEag.5Ws_HFI5fY.9fYgsQ_4F1D5vXltKmK5b7guCK',
//    instanceUrl: 'https://na15.salesforce.com',
//    proxyUrl: 'http://localhost:3000/proxy/'
//});



app.config(function ($routeProvider) {
    $routeProvider.
    when('/', {controller: HomeCtrl, templateUrl: 'apex/MobileSample_ngHome'}).
    when('/login', {controller: LoginCtrl, templateUrl: 'apex/MobileSample_ngLogin'}).
    when('/logout', {controller: LoginCtrl, templateUrl: 'apex/MobileSample_ngLogout'}).
    when('/callback', {controller: CallbackCtrl, templateUrl: 'partials/MobileSample_ngCallback'}).
    when('/contacts', {controller: "ContactListCtrl", templateUrl: 'apex/MobileSample_ngContactList'}).
    when('/view/:contactId', {controller: "ContactViewCtrl", templateUrl: 'apex/MobileSample_ngContactView'}).    
    when('/edit/:contactId', { controller: "ContactDetailCtrl", templateUrl: 'apex/MobileSample_ngContactEdit'}).
    when('/new', { controller: "ContactDetailCtrl", templateUrl: 'apex/MobileSample_ngContactEdit'}).
    otherwise({redirectTo: '/'});
});


/**
 * Please configure Salesforce consumerkey, proxyUrl etc in getSFConfig().
 *
 * SFConfig is a central configuration JS Object. It is used by angular-force.js and also your app to set and retrieve
 * various configuration or authentication related information.
 *
 * Note: Please configure SFConfig Salesforce consumerkey, proxyUrl etc in getSFConfig() below.
 *
 * @property SFConfig Salesforce Config object with the following properties.
 * @attribute {String} sfLoginURL       Salesforce login url
 * @attribute {String} consumerKey      Salesforce app's consumer key
 * @attribute {String} oAuthCallbackURL OAuth Callback URL. Note: If you are running on Heroku or elsewhere you need to set this.
 * @attribute {String} proxyUrl         URL to proxy cross-domain calls. Note: This nodejs app acts as a proxy server as well at <location>/proxy/
 * @attribute {String} client           ForcetkClient. Set by forcetk lib
 * @attribute {String} sessionId        Session Id. Set by forcetk lib
 * @attribute {String} apiVersion       REST Api version. Set by forcetk (Set this manually for visualforce)
 * @attribute {String} instanceUrl      Your Org. specific url. Set by forcetk.
 *
 * @returns SFConfig object depending on where (localhost v/s heroku v/s visualforce) the app is running.
 */
 function getSFConfig() {
    var location = document.location;
    var href = location.href;
    if (href.indexOf('file:') >= 0) { //Phonegap
        return {};
    } else if (configFromEnv && configFromEnv.sessionId) { //VisualForce just sets sessionId (as that's all what is required)
    return {
        sessionId: configFromEnv.sessionId
    }
} else {
    if (!configFromEnv || configFromEnv.client_id == "" || configFromEnv.client_id == "undefined"
        || configFromEnv.app_url == "" || configFromEnv.app_url == "undefined") {
        throw 'Environment variable client_id and/or app_url is missing. Please set them before you start the app';
}
return {
    sfLoginURL: 'https://login.salesforce.com/',
    consumerKey: configFromEnv.client_id,
    oAuthCallbackURL: removeTrailingSlash(configFromEnv.app_url) + '/#/callback',
    proxyUrl: removeTrailingSlash(configFromEnv.app_url) + '/proxy/'
}
}
}


//Helper
function removeTrailingSlash(url) {
    return url.replace(/\/$/, "");
}