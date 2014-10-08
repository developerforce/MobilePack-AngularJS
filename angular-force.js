/**
 * AngularForce library provides glue b/w Angular.js and Saleforce's forcetk libraries to help easily build
 * AngularJS based Salesforce apps.
 *
 * It contains the following two Angular Modules.
 * 1. AngularForce - Helps with authentication with Salesforce
 * 2. AngularForceObjectFactory - Creates & returns different kind of AngularForceObject class based on the params.
 *
 * @author Raja Rao DV @rajaraodv
 */


/**
 * AngularForce Module helps with authentication with Salesforce. It internally depends on Cordova(Phonegap apps) and
 * forcetk.ui(web apps) to do so.
 *
 * @param SFConfig An AngularJS object that is used to store forcetk.client.
 */
angular.module('AngularForce', []).
    service('AngularForce', function (SFConfig) {

        var self = this;

        var href =  document.location.href;
        this.inVisualforce = href.indexOf('visual.force.com') > 0 || href.indexOf('salesforce.com/apex/') > 0;
        
        this.refreshToken = localStorage.getItem('ftkui_refresh_token');

        this.isOnline = function () {
            return navigator.onLine ||
                (typeof navigator.connection != 'undefined' &&
                    navigator.connection.type !== Connection.UNKNOWN &&
                    navigator.connection.type !== Connection.NONE);
        };

        this.authenticated = function () {
            return SFConfig.client ? true : false;
        };


        this.login = function (callback) {
            if (SFConfig.client) { //already logged in
                return callback && callback();
            }

            //if offline..
            if (!this.isOnline()) {
                return callback && callback();
            }
            if (location.protocol === 'file:' && cordova) { //Cordova / PhoneGap
                return this.setCordovaLoginCred(callback);
            } else if (this.inVisualforce) { //visualforce
                return this.loginVF(callback);
            } else { //standalone / heroku / localhost
                return this.loginWeb(callback);
            }
        };

        /**
         *  setCordovaLoginCred initializes forcetk client in Cordova/PhoneGap apps (not web apps).
         *  Usage: Import AngularForce module into your initial view and call AngularForce.setCordovaLoginCred
         *
         *  Note: This should be used when SalesForce *native-phonegap* plugin is used for logging in to SF
         */
        this.setCordovaLoginCred = function (callback) {
            if (!cordova) throw 'Cordova/PhoneGap not found.';

            //Call getAuthCredentials to get the initial session credentials
            cordova.require("salesforce/plugin/oauth").getAuthCredentials(salesforceSessionRefreshed, getAuthCredentialsError);

            //register to receive notifications when autoRefreshOnForeground refreshes the sfdc session
            document.addEventListener("salesforceSessionRefresh", salesforceSessionRefreshed, false);
            function salesforceSessionRefreshed(creds) {
                // Depending on how we come into this method, `creds` may be callback data from the auth
                // plugin, or an event fired from the plugin.  The data is different between the two.
                var credsData = creds;
                if (creds.data)  // Event sets the `data` object with the auth data.
                    credsData = creds.data;

                SFConfig.client = new forcetk.Client(credsData.clientId, credsData.loginUrl);
                SFConfig.client.setSessionToken(credsData.accessToken, apiVersion, credsData.instanceUrl);
                SFConfig.client.setRefreshToken(credsData.refreshToken);

                //Set sessionID to angularForce coz profileImages need them
                self.sessionId = SFConfig.client.sessionId;

                callback && callback();
            }

            function getAuthCredentialsError(error) {
                logToConsole("getAuthCredentialsError: " + error);
            }
        };

        /**
         * Login using forcetk.ui (for non phonegap/cordova apps)
         * Usage: Import AngularForce and call AngularForce.login(callback)
         * @param callback A callback function (usually in the same controller that initiated login)
         */
        this.loginWeb = function (callback) {
            if (!SFConfig) throw 'Must set app.SFConfig where app is your AngularJS app';

            if (SFConfig.client) { //already loggedin
                return callback && callback();
            }
            var ftkClientUI = getForceTKClientUI(callback);
            ftkClientUI.login();
        };

        /**
         * Login to VF. Technically, you are already logged in when running the app, but we need this function
         * to set sessionId to SFConfig.client (forcetkClient)
         *
         * Usage: Import AngularForce and call AngularForce.login() while running in VF page.
         *
         * @param callback A callback function (usually in the same controller that initiated login)
         */
        this.loginVF = function (callback) {
            SFConfig.client = new forcetk.Client();
            SFConfig.client.setSessionToken(SFConfig.sessionId);

                initApp(null, SFConfig.client); //init entity framework

                //Set sessionID to angularForce coz profileImages need them
                self.sessionId = SFConfig.client.sessionId;

                //If callback is passed, call it.
                callback && callback();
        };


        this.oauthCallback = function (callbackString) {
            var ftkClientUI = getForceTKClientUI();
            ftkClientUI.oauthCallback(callbackString);
        };

        this.logout = function (callback) {
            if (SFConfig.client) {
                var ftkClientUI = getForceTKClientUI();
                ftkClientUI.client = SFConfig.client;
                ftkClientUI.instanceUrl = SFConfig.client.instanceUrl;
                ftkClientUI.proxyUrl = SFConfig.client.proxyUrl;
                ftkClientUI.logout(callback);

                //set SFConfig.client to null
                SFConfig.client = null;
            }
        };

        /**
         * Creates a forcetk.clientUI object using information from SFConfig. Please set SFConfig information
         * in init.js (or via environment variables).
         *
         * @returns {forcetk.ClientUI}
         */
        function getForceTKClientUI(callback) {

            function forceOAuthUI_successHandler(forcetkClient) {
                console.log('OAuth callback success!');
                SFConfig.client = forcetkClient;
                SFConfig.client.serviceURL = forcetkClient.instanceUrl
                    + '/services/data/'
                    + forcetkClient.apiVersion;

                initApp(null, forcetkClient);

                //Set sessionID to angularForce coz profileImages need them
                self.sessionId = SFConfig.client.sessionId;

                //If callback is passed, call it.
                callback && callback();
            }

            function forceOAuthUI_errorHandler() {
                //If callback is passed, call it.
                callback && callback();
            }

            return new forcetk.ClientUI(SFConfig.sfLoginURL, SFConfig.consumerKey, SFConfig.oAuthCallbackURL,
                forceOAuthUI_successHandler, forceOAuthUI_errorHandler, SFConfig.proxyUrl);
        }



    });

/**
 * AngularForceObjectFactory creates & returns different kind of AngularForceObject class based on the params.
 * Usage: Import AngularForceObjectFactory and pass params.
 * Where params are:
 * @params  type    String  An SF object type like: 'Opportunity', 'Contact' etc
 * @param   fields  Array An array of fields
 * @param   where   A SOQL Where clause for the object like 'Where IsWon = TRUE'
 *
 * var MySFObject = AngularForceObjectFactory({params})
 *
 * Example:
 * var Opportunity = AngularForceObjectFactory({type: 'Opportunity', fields:
 *          ['Name', 'ExpectedRevenue', 'StageName', 'CloseDate', 'Id'], where: 'WHERE IsWon = TRUE'});
 */
angular.module('AngularForceObjectFactory', []).factory('AngularForceObjectFactory', function (SFConfig, AngularForce) {
    function AngularForceObjectFactory(params) {
        params = params || {};
        var type = params.type;
        var fields = params.fields;
        var where = params.where;
        var limit = params.limit;
        var orderBy = params.orderBy;
        var soslFields = params.soslFields || 'ALL FIELDS';
        var fieldsArray = angular.isArray(params.fields) ? params.fields : [];

        //Make it soql compliant
        fields = fields && fields.length > 0 ? fields.join(', ') : '';
        where = where && where != '' ? ' where ' + where : '';
        limit = limit && limit != '' ? ' LIMIT ' + limit : ' LIMIT 25';
        orderBy = orderBy && orderBy != '' ? ' ORDER BY ' + orderBy : '';

        //Construct SOQL
        var soql = 'SELECT ' + fields + ' FROM ' + type + where + orderBy + limit;

        //Construct SOSL
        // Note: "__SEARCH_TERM_PLACEHOLDER__" will be replaced by actual search query just before making that query
        var sosl = 'Find {__SEARCH_TERM_PLACEHOLDER__*} IN ' + soslFields + ' RETURNING ' + type + ' (' + fields + ')';

        /**
         * AngularForceObject acts like a super-class for actual SF Objects. It provides wrapper to forcetk ajax apis
         * like update, destroy, query, get etc.
         * @param props JSON representing a single SF Object
         *
         * Usage:
         * 1. First import AngularForceObjectFactory into your AngularJS main app-module.
         *
         * 2. Create an SF Object Class from the factory like this:
         *      var Opportunity = AngularForceObjectFactory({type: 'Opportunity', fields: ['Name', 'CloseDate', 'Id'], where: 'WHERE IsWon = TRUE'});
         *
         * 3. Create actual object by passing JSON from DB like this:
         *      var myOpp = new Opportunity({fields: {'Name': 'Big Opportunity', 'CloseDate': '2013-03-03', 'Id': '12312'});
         */
        function AngularForceObject(props) {
            angular.copy(props || {}, this);
            this._orig = props || {};
        }

        /************************************
         * CRUD operations
         ************************************/
        AngularForceObject.prototype.update = function (successCB, failureCB) {
            return AngularForceObject.update(this, successCB, failureCB);
        };

        AngularForceObject.prototype.destroy = function (successCB, failureCB) {
            return AngularForceObject.remove(this, successCB, failureCB);
        };


        AngularForceObject.prototype.setWhere = function (whereClause) {
            where = whereClause;
        };

        AngularForceObject.query = function (successCB, failureCB) {
            return AngularForceObject.queryWithCustomSOQL(soql, successCB, failureCB);
        };

        AngularForceObject.queryWithCustomSOQL = function (soql, successCB, failureCB) {
            // return SFConfig.client.query(soql, successCB, failureCB);

            var self = this;
            var config = {};

            // fetch list from forcetk and populate SOBject model
            if (AngularForce.isOnline()) {
                config.type = 'soql';
                config.query = soql;

            } else if (navigator.smartstore) {
                config.type = 'cache';
                config.cacheQuery = navigator.smartstore.buildExactQuerySpec('attributes.type', type);
            }

            Force.fetchSObjects(config, SFConfig.dataStore).done(function (resp) {
                var processFetchResult = function (records) {
                    //Recursively get records until no more records or maxListSize
                    if (resp.hasMore() && (SFConfig.maxListSize || 25) > resp.records.length) {
                        resp.getMore().done(processFetchResult);

                    } else {
                        return successCB(resp);
                    }
                }
                processFetchResult(resp.records);

            }).fail(failureCB);
        };

        /*RSC And who doesn't love SOSL*/
        AngularForceObject.search = function (searchTerm, successCB, failureCB) {

            //Replace __SEARCH_TERM_PLACEHOLDER__ from SOSL with actual search term.
            var s = sosl.replace('__SEARCH_TERM_PLACEHOLDER__', searchTerm);
            return SFConfig.client.search(s, successCB, failureCB);
        };


        AngularForceObject.get = function (params, successCB, failureCB) {
            return Force.syncSObject('read', type, params.id, null, fieldsArray, SFConfig.dataStore, AngularForce.isOnline() ? Force.CACHE_MODE.SERVER_FIRST : Force.CACHE_MODE.CACHE_ONLY)
                .done(function (data) {
                    return successCB(new AngularForceObject(data));
                }).fail(failureCB);
        };

        AngularForceObject.save = function (obj, successCB, failureCB) {
            var data = AngularForceObject.getNewObjectData(obj);

            return Force.syncSObject('create', type, null, data, fieldsArray, SFConfig.dataStore, AngularForce.isOnline() ? Force.CACHE_MODE.SERVER_FIRST : Force.CACHE_MODE.CACHE_ONLY)
                .done(function (data) {
                    return successCB(new AngularForceObject(data));
                }).fail(failureCB);
        };

        AngularForceObject.update = function (obj, successCB, failureCB) {
            var changedData = AngularForceObject.getChangedData(obj);
            return Force.syncSObject('update', type, obj.Id, changedData, _.keys(changedData), SFConfig.dataStore, AngularForce.isOnline() ? Force.CACHE_MODE.SERVER_FIRST : Force.CACHE_MODE.CACHE_ONLY)
                .done(function (data) {
                    return successCB(new AngularForceObject(data));
                }).fail(failureCB);
        };

        AngularForceObject.remove = function (obj, successCB, failureCB) {
            return Force.syncSObject('delete', type, obj.Id, null, null, SFConfig.dataStore, AngularForce.isOnline() ? Force.CACHE_MODE.SERVER_FIRST : Force.CACHE_MODE.CACHE_ONLY)
                .done(function (data) {
                    return successCB(new AngularForceObject(data));
                }).fail(failureCB);
        };

        /************************************
         * HELPERS
         ************************************/
        AngularForceObject.getChangedData = function (obj) {
            var diff = {};
            var orig = obj._orig;
            if (!orig)  return {};
            angular.forEach(fieldsArray, function (field) {
                if (field != 'Id' && obj[field] !== orig[field]) diff[field] = obj[field];
            });
            return diff;
        };

        AngularForceObject.getNewObjectData = function (obj) {
            var newObj = {};
            angular.forEach(fieldsArray, function (field) {
                if (field != 'Id') {
                    newObj[field] = obj[field];
                }
            });
            return newObj;
        };


        return AngularForceObject;
    }

    return AngularForceObjectFactory;
});
