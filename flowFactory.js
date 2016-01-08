// Author: Sheldon Trotman

var main = angular
    .module("main")
    .factory("flow", ["$rootScope", "$location", "$window", flowConstructor]);

function flowConstructor ($rootScope, $location, $window) {
    var service = {

        start: function(scope, startingFlowObject, initializeVariables, completeEndSuccess, completeEndFailure) { 
            // Creation of the flow structure
            
            if ((scope != null) && (startingFlowObject != null))  {
                var globalStorage = initializeVariables;
                if (initializeVariables == null) {
                    globalStorage = {};
                }

                // Gather the variables that will be persisted across all of the blocks
                startingFlowObject.globalStorage = globalStorage;
                startingFlowObject.globalStorage.rootScope = $rootScope;
                startingFlowObject.globalStorage.location = $location;
                startingFlowObject.globalStorage.window = $window;
                startingFlowObject.globalStorage.scope = scope;
                startingFlowObject.globalStorage.continueOperation = true;

                // Initialize the next and in the event of a failure a stop
                startingFlowObject.nextFlow = service.terminal(globalStorage, completeEndSuccess, []).run;
                startingFlowObject.stopFlow = service.terminal(globalStorage, completeEndFailure, []).run;

                return startingFlowObject.run();
            } else {
                console.error("Initiator flow has not been properly set up.");
                return;
            }
        },

        sequence: function(inputFP) {
            // (Collection) Allows all the interal building blocks to run in order and moves to the next block when completed

            var flowType = "sequence";
            var flowIndex = 0;
            var completionCounter = 0;

            var fp = [];
            if (inputFP != null) {
                fp = inputFP.slice();
            };

            var service = {
                flowPath: fp,
                globalStorage: null,
                nextFlow: null,
                stopFlow: null,

                getFlowType: function() {
                    return flowType;
                },

                add: function(flowObject) {
                    service.flowPath.push(flowObject);
                },

                run: function() {
                    // This gets called when the entire sequence collection is called
                    if (service.flowPath.length == 0) {
                        return service.nextFlow();
                    } else {
                        if ((service.globalStorage != null) && (service.nextFlow != null) && (service.stopFlow != null))  {
                            // Set up the connections in the flow
                            for(var objIndex = 0; objIndex < service.flowPath.length-1; objIndex++) {
                                var currentFlowObj = service.flowPath[objIndex];
                                var nextFlowFlowObj = service.flowPath[objIndex+1];

                                // Set up the current flow object
                                currentFlowObj.globalStorage = service.globalStorage;
                                currentFlowObj.nextFlow = nextFlowFlowObj.run;

                                // Set to parent if there is no stop
                                if(currentFlowObj.stopFlow == null) {
                                    currentFlowObj.stopFlow = service.stopFlow;
                                }
                            }

                            // Last object calls a stopFlow
                            var lastFlowObj = service.flowPath[service.flowPath.length-1];
                            lastFlowObj.globalStorage = service.globalStorage;
                            lastFlowObj.nextFlow = service.nextFlow;
                            lastFlowObj.stopFlow = service.stopFlow;

                            // Start sequence
                            if ((service.globalStorage.continueOperation) && (service.flowPath.length > 0)) {
                                var firstFlowObject = service.flowPath[0];
                                return firstFlowObject.run();
                            
                            } else {
                                return service.stopFlow();
                            }
                        } else {
                            // Not a valid sequence initialization
                            console.error("Sequence flow has not been properly set up.");
                            return;
                        }
                    }
                }
            };

            return service;
        },
        
        parallel: function(inputFP) {
            // (Collection) Allows all the interal building blocks to run at the same time and moves to the next when completed

            var flowType = "parallel";
            
            var fp = [];
            if (inputFP != null) {
                fp = inputFP.slice();
            };

            var service = {
                flowPath: fp,
                globalStorage: null,
                nextFlow: null,
                stopFlow: null,

                getFlowType: function() {
                    return flowType;
                },

                add: function(flowObject) {
                    service.flowPath.push(flowObject);
                },

                run: function() {
                    // This gets called when the entire parallel collection is called
                    var completionCounter = 0;
                    if (service.flowPath.length == 0) {
                        service.flowPath = [];
                    };

                    if ((service.globalStorage.continueOperation) && (service.globalStorage != null) && (service.nextFlow != null) && (service.stopFlow != null))  {
                        var completedParallelCall = function() {

                            // Deal with when a call returns
                            completionCounter ++;

                            if (!service.globalStorage.continueOperation) {
                                return service.stopFlow();
                            } else if (completionCounter == service.flowPath.length) {
                                return service.nextFlow();
                            }
                        }

                        // Set up the connections in the flow
                        for(var objIndex = 0; objIndex < service.flowPath.length; objIndex++) {
                            var currentFlowObj = service.flowPath[objIndex];

                            // Set up the current flow object
                            currentFlowObj.globalStorage = service.globalStorage;
                            currentFlowObj.nextFlow = completedParallelCall;

                            // Set to parent if there is no stop
                            if(currentFlowObj.stopFlow == null) {
                                currentFlowObj.stopFlow = service.stopFlow;
                            }

                            currentFlowObj.run();
                        }
                    } else {
                        // Not a valid parallel initialization
                        console.error("Parallel flow has not been properly set up.");
                        return;
                    }
                }
            };

            return service;
        },

        plain: function(func, attr) {
            // (Basic) Does not wait just runs the function

            var flowType = "plain";

             var service = {
                flowFunction: func,
                functionAttributes: attr,

                globalStorage: null,
                nextFlow: null,
                stopFlow: null,

                getFlowType: function() {
                    return flowType;
                },

                run: function() {
                    // This gets called when the plain is called
                    if ((service.globalStorage != null) && (service.nextFlow != null) && (service.stopFlow != null))  {
                        service.flowFunction(service.globalStorage, service.functionAttributes);
                        
                        return service.nextFlow();
                    } else {
                        // Not a valid plain initialization
                        console.error("Plain flow has not been properly set up.");
                        return;
                    }
                },
            }

            return service;
        },

        terminal: function(globalStorage, endFunction, functionAttributes) {
            // (Basic) Does not wait just runs the function but has no future block

            if (globalStorage != null) {
                var endFlowObj = new service.plain(endFunction, functionAttributes);
                endFlowObj.globalStorage = globalStorage;
                endFlowObj.nextFlow = function(){};
                endFlowObj.stopFlow = function(){};

                // If the inputed end is blank
                if (endFunction == null) {
                    endFlowObj.flowFunction = function(){};
                };

                return endFlowObj
            } else {
                // Not a valid terminal initialization
                console.error("Terminal flow has not been properly set up.");
                return;
            }
        },

        singular: function(func, attr, success, failure, eof, stopFlowFunction) {
            // (Basic) Has to wait for the called funciton to return
            var flowType = "singular";

            var service = {
                flowFunction: func,
                functionAttributes: attr,
                functionSuccess: success,
                functionFailure: failure,
                endOnFailure: eof,

                globalStorage: null,
                nextFlow: null,
                stopFlow: stopFlowFunction,

                getFlowType: function() {
                    return flowType;
                },

                run: function () {
                    // This gets called when the singular is called
                    if ((service.globalStorage != null) && (service.nextFlow != null) && (service.stopFlow != null))  {

                        service.flowFunction(service.globalStorage, service.functionAttributes)
                        .then( function (response) {
                            if (service.globalStorage.continueOperation) {
                                // Successful return
                                service.functionSuccess(service.globalStorage, response);
                            
                                return service.nextFlow();
                            } else {
                                // Global stopFlow forced exit
                                return service.stopFlow();
                            }

                        }).catch( function (response){
                            if (service.globalStorage.continueOperation) {
                                service.functionFailure(service.globalStorage, response);
                                
                                if (service.endOnFailure) {
                                    // Failed call, stopFlow all future action due to failure
                                    service.globalStorage.continueOperation = false;
                                    return service.stopFlow();

                                } else {
                                    // Complete call
                                    return service.nextFlow();
                                }
                            } else {
                                return service.stopFlow();
                            }
                        });
                    } else {
                        // Not a valid singular initialization
                        console.error("Singular flow has not been properly set up.");
                        return;
                    }
                }
            };

            return service;
        }
    };
    return service;
}