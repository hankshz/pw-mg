var app = angular.module('myApp', ['ngRoute', "ngStorage", 'ngAnimate', 'ngSanitize', 'ui.bootstrap']).config(['$routeProvider', function($routeProvider) {
    $routeProvider
    .when('/generate', {
        templateUrl: '../html/generate.tpl.html',
        controller: 'GenerateCtrl',
        resolve: {
            site: function ($q) {
                  var defer = $q.defer();
                  chrome.tabs.query({
                        active: true,
                        lastFocusedWindow: true
                    }, function(tabs) {
                        var uri = new URI(tabs[0].url);
                        defer.resolve(uri.authority);
                    });
                  return defer.promise;
                }
            },
    })
    .when('/config', {
        templateUrl: '../html/config.tpl.html',
        controller: 'ConfigCtrl',
    })
    .when('/summary', {
        templateUrl: '../html/summary.tpl.html',
        controller: 'SummaryCtrl',
    })
    .when('/about', {
        templateUrl: '../html/about.tpl.html',
    })
    .otherwise({redirectTo: '/generate'});
}]);

app.directive('validatePassword', function() {
  return {
    require: 'ngModel',
    link: function($scope, $element, $attrs, $ctrl) {
      var getModelValue = function() {
        return $ctrl.$viewValue;
      };
      var getLengthValue = function() {
        return $attrs.validatePassword || 5;
      };
      var setValidity = function (isValid) {
        $ctrl.$setValidity('validatePassword', isValid);
      };
      $scope.$watch(getModelValue, function(newValue, oldValue) {
        var isValid = true;
        if (newValue == null) {
            isValid = false;
        } else if (newValue.length < getLengthValue()) {
            console.log("not long enough");
            isValid = false;
        } else if ( !(/[!@#$%&]+/.test(newValue)) ) {
            console.log("no !@#$%&");
            isValid = false;
        } else if ( !(/[A-Z]+/.test(newValue)) ) {
            console.log("no A-Z");
            isValid = false;
        } else if ( !(/[a-z]+/.test(newValue)) ) {
            console.log("no a-z");
            isValid = false;
        } else if ( !(/[0-9]+/.test(newValue)) ) {
            console.log("no 0-9");
            isValid = false;
        }
        setValidity(isValid);
      });
    }
  };
});

app.directive('validateEqual', function() {
  return {
    require: 'ngModel',
    link: function($scope, $element, $attrs, $ctrl) {
      var getModelValue = function() {
        return $ctrl.$viewValue;
      };
      var getEqualToValue = function() {
        return $scope.$eval($attrs.validateEqual);
      };
      var setValidity = function (isValid) {
        $ctrl.$setValidity('validateEqual', isValid);
      };
      $scope.$watch(getModelValue, function(newValue, oldValue) {
        setValidity(newValue === getEqualToValue());
      });
      $scope.$watch(getEqualToValue, function(newValue, oldValue) {
        setValidity(getModelValue() === newValue);
      });
    }
  };
});

app.service('myAlert', function($timeout) {
    var alerts = [];

    var pushAlert = function(type, msg) {
        var entry = {type: type, msg: msg};
        alerts.push(entry);
        return entry; // Use the entry as key
    }

    var removeAlert = function(key) {
        alerts.splice(alerts.indexOf(key), 1);
    };

    this.bindAlerts = function() {
        return alerts;
    }

    this.addAlert = function(type, msg, timeout) {
        var key = pushAlert(type, msg);
        if ( timeout != null ) {
            $timeout(function () {
                removeAlert(key);
            }, timeout);
        }
    };

    this.delAlert = function(index) {
        alerts.splice(index, 1);
    };
});

app.service('myStorage', ['$localStorage', 'myAlert', function($localStorage, myAlert) {
    var defaults = {};
    defaults.config = {
       uppperCase : true,
       lowerCase : true,
       number : true,
       sign : true,
       length : "10",
       algorithm : "MD5",
       showPassword : false,
       autoFill : true,
       randomUsername : true,
       username : "awesomebot",
       cache : 'session',
    };
    password = null;

    this.save = function(key, data) {
        $localStorage[key] = data;
    }

    this.load = function(key) {
        return $localStorage[key];
    }

    this.defaults = function(key) {
        if (key in defaults) {
            return angular.copy(defaults[key]);
        }
        else
        {
            alert("Undefined default " + key);
            return null;
        }
    }

    this.setConfig = function(config) {
        this.save('config', config);
    }

    this.getConfig = function() {
        return this.load('config') || this.defaults('config');
    }

    this.loadPassword = function(new_password) {
        password = new_password;
    }

    this.delPassword = function() {
        if ($localStorage['myPrecious'] !== null) {
            delete $localStorage['myPrecious'];
            myAlert.addAlert('warning', 'Delete the password in Chrome', 5000);
        }
    }

    this.getPassword = function() {
        return password;
    }

    this.setPassword = function(new_password=null, force_mode=null) {
        var mode;
        if (new_password !== null) {
            password = new_password;
        }
        if (force_mode !== null) {
            mode = force_mode;
        } else {
            mode = this.getConfig().cache;
        }
        switch (mode) {
            case "never":
                if ($localStorage['myPrecious'] !== null) {
                    delete $localStorage['myPrecious'];
                }
                chrome.runtime.getBackgroundPage(function(bg) {
                    bg.password = null;
                });
                break;
            case "forever":
                myAlert.addAlert('warning', 'Save the password to Chrome permanently', 5000);
                $localStorage['myPrecious'] = password;
                chrome.runtime.getBackgroundPage(function(bg) {
                    bg.password = null;
                });
                break;
            case "session":
                myAlert.addAlert('warning', 'Save the password to Chrome for this session', 5000);
                if ($localStorage['myPrecious'] !== null) {
                    delete $localStorage['myPrecious'];
                }
                chrome.runtime.getBackgroundPage(function(bg) {
                    bg.password = password;
                });
                break;
            case "timeout":
                alert('TODO');
                break;
            default:
                alert("Undefined cache " + $scope.current.config.cache);
                break;
        }
    }

    this.saveSite = function (site, username, config) {
        var sites = this.load('sites');
        if (sites == null) {
            sites = {};
        }
        if (!(site in sites)) {
            sites[site] = {};
        }
        sites[site][username] = config;
        this.save('sites', sites);
    }

    this.deleteSite = function (site, username) {
        var sites = this.load('sites');
        if (sites == null) {
            return;
        }
        if (!(site in sites)) {
            return;
        }
        delete sites[site][username];
        if (sites[site].length == 0) {
            delete sites[site];
        }
        this.save('sites', sites);
    }

    this.searchSite = function (site) {
        var sites = this.load('sites');
        if (sites == null) {
            return {};
        }
        if (!(site in sites)) {
            return {};
        }
        return sites[site];
    }

    this.loadSites = function () {
        var sites = this.load('sites');
        if (sites == null) {
            return {};
        }
        return sites;
    }

    var dataHash = function(algorithm, key, data, charset) {
        key += data;

        var password = "";
        switch (algorithm) {
            case "SHA256":
                password = PasswordMaker_SHA256.any_sha256(key, charset);
                break;
            case "SHA1":
                password = PasswordMaker_SHA1.any_sha1(key, charset);
                break;
            case "MD4":
                password = PasswordMaker_MD4.any_md4(key, charset);
                break;
            case "MD5":
                password = PasswordMaker_MD5.any_md5(key, charset);
                break;
            default:
                alert("Undefined algorithm " + algorithm);
                break;
        }
        return password;
    };

    this.generatePassword = function (site, username, config) {
        var masterPassword = this.getPassword()
        if (masterPassword === null) {
            return;
        }
        var password = "";
        var charset = ""
        if (config.uppperCase === true) {
            charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        }
        if (config.lowerCase === true) {
            charset += "abcdefghijklmnopqrstuvwxyz";
        }
        if (config.number === true) {
            charset += "0123456789";
        }
        if (config.sign === true) {
            charset += "!@#$%&";
        }
        if (charset.length < 2) {
            myAlert.addAlert('danger', 'Need enough charset to generate the password', 5000);
            return;
        }
        while (password.length < config.length) {
            password += dataHash(config.algorithm, masterPassword,
                site + username, charset);
        }
        return password.slice(0, config.length);
    };

    chrome.runtime.getBackgroundPage(function(bg) {
        new_password = $localStorage['myPrecious'] || bg.password;
        this.loadPassword(new_password);
    }.bind(this));
}]);

app.controller('MainCtrl', ['$scope', 'myStorage', 'myAlert', function($scope, myStorage, myAlert){
    $scope.alerts = myAlert.bindAlerts();
    $scope.hideDisplay=true;
    $scope.hideAutomation=true;
    $scope.hideGeneration=false;

    $scope.closeAlert = function(index) {
        myAlert.delAlert(index);
    };
    $scope.$watch(function() {
        return $scope.masterform.password.$dirty && $scope.masterform.password.$valid && $scope.masterform.confirm.$dirty && $scope.masterform.confirm.$valid;
      }, function(newValue, oldValue) {
        if (newValue === true) {
            myStorage.setPassword($scope.confirm, null);
        }
      });
    $scope.$watch(function() {
        return myStorage.getPassword();
      }, function(newValue, oldValue) {
        $scope.confirm = newValue;
        $scope.password = newValue;
      });
}]);

app.controller('ConfigCtrl', ['$scope', 'myStorage', 'myAlert', function($scope, myStorage, myAlert){
    $scope.config = myStorage.getConfig();
    $scope.save = function() {
        myStorage.setConfig($scope.config);
    };
    $scope.reset = function() {
        $scope.config = myStorage.defaults('config');
    };
    $scope.$watch(function() {
        return myStorage.getConfig().cache;
      }, function(newValue, oldValue) {
        myStorage.setPassword(null, null);
      });
}]);

app.filter('orderObjectBy', function() {
    return function(items, field, reverse) {
        var filtered = [];
        angular.forEach(items, function(item) {
        filtered.push(item);
    });
    filtered.sort(function (a, b) {
        return (a[field] > b[field] ? 1 : -1);
    });
    if(reverse) filtered.reverse();
        return filtered;
    };
});


app.controller('SummaryCtrl', ['$scope', '$filter', '$uibModal', 'myStorage', 'myAlert', function($scope, $filter, $uibModal, myStorage, myAlert){
    var $ctrl = this;

    $scope.calculatePassword = function (entry) {
        return myStorage.generatePassword(entry.site, entry.username, entry.config);
    };

    $scope.loadData = function () {
        allData = [];
        rawData = myStorage.loadSites();
        for (var site in rawData) {
            for (username in rawData[site]) {
                allData.push({site:site, username:username, config:rawData[site][username]});
            }
        }
        $scope.totalItems = allData.length;
        $scope.data = $filter('orderObjectBy')(allData, $scope.sortType, $scope.sortReverse).slice(($scope.currentPage-1) * $scope.itemsPerPage, $scope.currentPage * $scope.itemsPerPage);
    }

    $scope.export = function() {
        var a = document.createElement('a');
        a.href = 'data:attachment/csv,' + JSON.stringify($scope.loadData());
        a.target = '_blank';
        a.download = 'config.txt';
        document.body.appendChild(a);
        a.click();
    };

    $scope.import = function () {
        var modalInstance = $uibModal.open({
            animation: true,
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: '../html/fileDrop.tpl.html',
            controller: 'ModalInstanceCtrl',
            controllerAs: '$ctrl',
            size: 'lg',
            appendTo: undefined,
        });

        modalInstance.result.then(function (inputs) {
            config = JSON.parse(inputs);
            for (var i = 0; i < config.length; i++) {
                myStorage.saveSite(config[i].site, config[i].username, config[i].config);
            }
            $scope.loadData();
        }, function () {
            console.log('Modal dismissed at: ' + new Date());
        });
    };

    $scope.copyPassword = function(entry) {
        var copyDiv = document.createElement('div');
        copyDiv.contentEditable = true;
        document.body.appendChild(copyDiv);
        copyDiv.innerHTML = $scope.calculatePassword(entry);
        copyDiv.unselectable = "off";
        copyDiv.focus();
        document.execCommand('SelectAll');
        document.execCommand("Copy", false, null);
        document.body.removeChild(copyDiv);
    }

    $scope.currentPage = 1;
    $scope.itemsPerPage = 10;
    $scope.sortType = 'site';
    $scope.sortReverse = false;
    $scope.loadData();
}]);

app.controller('ModalInstanceCtrl', ['$scope', '$uibModalInstance', function($scope, $uibModalInstance){
    $scope.importInput = '';

    $scope.ok = function () {
        $uibModalInstance.close($scope.importInput);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);

app.controller('GenerateCtrl', ['$scope', '$route', 'myStorage', 'myAlert', function($scope, $route, myStorage, myAlert){
    $scope.createRandomUsername = function (length) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for( var i=0; i < length; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        $scope.current.username = text;
    };
    $scope.save = function () {
        myAlert.addAlert('warning', 'Save the config for this site', 5000);
        myStorage.saveSite($scope.current.site, $scope.current.username, $scope.current.config);
    }
    $scope.del = function () {
        myAlert.addAlert('warning', 'Delte the config for this user', 5000);
        myStorage.deleteSite($scope.current.site, $scope.current.username);
    }
    $scope.copy = function() {
        var copyDiv = document.createElement('div');
        copyDiv.contentEditable = true;
        document.body.appendChild(copyDiv);
        copyDiv.innerHTML = $scope.password;
        copyDiv.unselectable = "off";
        copyDiv.focus();
        document.execCommand('SelectAll');
        document.execCommand("Copy", false, null);
        document.body.removeChild(copyDiv);
    }
    $scope.fill = function () {
        chrome.tabs.executeScript({
            "allFrames": true,
            // base-64 encode & decode password, string concatenation of a pasword that includes quotes here won't work
            "code": "var fields = document.getElementsByTagName('input');" +
                    "var nameFilled = false, passFilled = false;" +
                    "for (var i = 0; i < fields.length; i++) {" +
                        "var elStyle = getComputedStyle(fields[i]);" +
                        "var isVisible = !(/none/i).test(elStyle.display) && !(/hidden/i).test(elStyle.visibility) && parseFloat(elStyle.width) > 0 && parseFloat(elStyle.height) > 0;" +
                        "var isPasswordField = (/password/i).test(fields[i].type + ' ' + fields[i].name);" +
                        "var isUsernameField = (/id|un|name|user|usr|log|email|mail|acct|ssn/i).test(fields[i].name) && (/^(?!display)/i).test(fields[i].name);" +
                        "var isEmptyUsernameField = isVisible && !nameFilled && fields[i].value.length === 0 && isUsernameField && !isPasswordField;" +
                        "var changeEvent = new Event('change', {'bubbles': true, 'cancelable': true});" + // MVC friendly way to force a view-model update
                        "if (isVisible && !passFilled && fields[i].value.length === 0 && isPasswordField) {" +
                            "fields[i].value = atob('" + btoa($scope.password) + "');" +
                            "passFilled = true;" +
                            "fields[i].dispatchEvent(changeEvent);" +
                        "}" +
                        "if (isEmptyUsernameField) {" +
                            "fields[i].value = atob('" + btoa($scope.current.username) + "');" +
                            "if (fields[i].value.length === 0) {" +
                                "fields[i].focus();" +
                            "}" +
                            "nameFilled = true;" +
                            "fields[i].dispatchEvent(changeEvent);" +
                        "}" +
                    "}"
        });
    }
    var site = $route.current.locals.site;
    $scope.current = {'config':null, 'site':site, 'username':null};
    $scope.usernames = [];
    var entries = myStorage.searchSite(site);
    console.log(entries);
    for (var username in entries) {
        var config = entries[username];
        $scope.usernames.push(username);
        $scope.current.username = username;
        $scope.current.config = config;
    }
    if ($scope.current.username === null) {
        $scope.current.config = myStorage.getConfig();
        if ( $scope.current.config.randomUsername === true ) {
            $scope.createRandomUsername(10);
        } else {
            $scope.current.username = $scope.current.config.username;
        }
    }
    $scope.$watch(function() {
        return $scope.current.username;
      }, function(newValue, oldValue) {
        var entries = myStorage.searchSite($scope.current.site);
        if (newValue in entries) {
            $scope.current.config = entries[newValue];
        } else {
            $scope.current.config = myStorage.getConfig();
        }
      }, true);
    $scope.$watch(function() {
        return $scope.current;
      }, function(newValue, oldValue) {
        $scope.password = myStorage.generatePassword($scope.current.site, $scope.current.username, $scope.current.config);
        if (myStorage.getConfig().autoFill) {
            $scope.fill();
        }
      }, true);
    $scope.$watch(function() {
        return myStorage.getPassword();
      }, function(newValue, oldValue) {
        $scope.password = myStorage.generatePassword($scope.current.site, $scope.current.username, $scope.current.config);
        if (myStorage.getConfig().autoFill) {
            $scope.fill();
        }
      }, true);
}]);
