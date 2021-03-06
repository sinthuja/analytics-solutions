/*
 * Copyright (c) 2018, WSO2 Inc. (http://wso2.com) All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import Widget from '@wso2-dashboards/widget';
import VizG from 'react-vizgrammar';
import _ from 'lodash';

// Initial Metadata
const metadata = {
    names: ['AGG_TIMESTAMP', 'serverName', 'avgRespTime'],
    types: ['TIME', 'ORDINAL', 'LINEAR'],
};

// Initial Chart config
const chartConfigTemplate = {
    x: 'AGG_TIMESTAMP',
    charts: [
        {
            type: 'bar',
            y: 'avgRespTime',
            fill: '#00e1d6',
            color: 'serverName',
            style: { strokeWidth: 2, markRadius: 3 },
        },
    ],
    legend: true,
    animate: false,
    style: {
        legendTitleColor: '#5d6e77',
        legendTextColor: '#5d6e77',
        tickLabelColor: '#5d6e77',
        axisLabelColor: '#5d6e77',
    },
    gridColor: '#5d6e77',
    brush: true,
    xAxisLabel: 'Time',
    yAxisLabel: 'Average Latency (ms)',
    append: false,
    timeStep: 'month',
    tipTimeFormat: '%Y-%m-%d %H:%M:%S',
};

/**
 * HTTPAnalyticsLatencyOverTime Widget which plots a line graph for latency overtime
 */
class HTTPAnalyticsLatencyOverTime extends Widget {
    /**
     * Constructor. Initialises the widget.
     * @param {JSON} props Props from Portal app.
     */
    constructor(props) {
        super(props);

        this.state = {
            width: this.props.glContainer.width,
            height: this.props.glContainer.height,
            chartConfig: chartConfigTemplate,
            data: [],
            metadata,
            faultyProviderConf: false,
        };

        this.handleDataReceived = this.handleDataReceived.bind(this);
        this.setReceivedMsg = this.setReceivedMsg.bind(this);
        this.assembleQuery = this.assembleQuery.bind(this);
        this.props.glContainer.on('resize', () => {
            this.setState({ width: this.props.glContainer.width, height: this.props.glContainer.height });
        });
    }

    /**
     * Initialize widget.
     */
    componentDidMount() {
        super.getWidgetConfiguration(this.props.widgetID)
            .then((message) => {
                this.setState({
                    dataProviderConf: message.data.configs.providerConfig,
                }, () => super.subscribe(this.setReceivedMsg));
            })
            .catch(() => {
                this.setState({
                    faultyProviderConf: true,
                });
            });
    }

    /**
     * Releases resources.
     */
    componentWillUnmount() {
        super.getWidgetChannelManager().unsubscribeWidget(this.props.id);
    }

    /**
     * Set the state of the widget after metadata and data is received from Data Provider
     * @param {JSON} message Message received from data Provider
     */
    handleDataReceived(message) {
        const configClone = _.cloneDeep(chartConfigTemplate);
        [, configClone.charts[0].color] = message.metadata.names;
        configClone.timeStep = this.state.per;

        this.setState({
            chartConfig: configClone,
            metadata: message.metadata,
            data: message.data,
        });
        window.dispatchEvent(new Event('resize'));
    }

    /**
     * Set state based on received user input from Filter widget and Date Range Picker widget
     * @param {JSON} receivedMsg data received from publisher widget
     */
    setReceivedMsg(receivedMsg) {
        if (typeof receivedMsg.perspective === 'number') {
            this.setState({
                perspective: receivedMsg.perspective,
                selectedCellValues: receivedMsg.selectedCellValues,
                selectedServerValues: receivedMsg.selectedServerValues,
                selectedServiceValues: receivedMsg.selectedServiceValues,
                selectedMethodValues: receivedMsg.selectedMethodValues,
                selectedSingleServiceValue: receivedMsg.selectedSingleServiceValue,
            }, this.assembleQuery);
        } else {
            this.setState({
                per: receivedMsg.granularity,
                fromDate: receivedMsg.from,
                toDate: receivedMsg.to,
            }, this.assembleQuery);
        }
    }

    getFilterQuery(){
        let filterCondition = "(";
        if (!this.state.selectedCellValues.some(value => value.value === 'All')
            && this.state.selectedCellValues.length !== 0) {
            this.state.selectedCellValues.forEach((value) => {
                if (filterCondition !== "("){
                    filterCondition += " or ";
                }
                filterCondition += "cellName=='" + value.value +"'";
            });
            filterCondition += ")";
        }

        if (!this.state.selectedServerValues.some(value => value.value === 'All')
            && this.state.selectedServerValues.length !== 0) {
            if (filterCondition !== "("){
                filterCondition += " and (";
            }
            this.state.selectedServerValues.forEach((value) => {
                if (filterCondition !== ""){
                    filterCondition += " or ";
                }
                filterCondition += "serverName=='" + value.value + "'";
            });
            filterCondition += ")";
        }

        if (!this.state.selectedServiceValues.some(value => value.value === 'All')
            && this.state.selectedServiceValues.length !== 0) {
            if (filterCondition !== "("){
                filterCondition += " and (";
            }
            this.state.selectedServiceValues.forEach((value) => {
                if (filterCondition !== ""){
                    filterCondition += " or ";
                }
                filterCondition += "serviceName=='" + value.value + "'";
            });
            filterCondition += ")";
        }

        if (!this.state.selectedMethodValues.some(value => value.value === 'All')
            && this.state.selectedMethodValues.length !== 0) {
            if (filterCondition !== "("){
                filterCondition += " and (";
            }
            this.state.selectedMethodValues.forEach((value) => {
                if (filterCondition !== ""){
                    filterCondition += " or ";
                }
                filterCondition += "serviceName=='" + value.value + "'";
            });
            filterCondition += ")";
        }

        if (filterCondition === "("){
            filterCondition = "";
        }
        return filterCondition;
    }

    /**
     * Query is initialised after the user input is received
     */
    assembleQuery() {
        if (typeof this.state.perspective === 'number' && typeof this.state.per === 'string') {
            super.getWidgetChannelManager().unsubscribeWidget(this.props.id);
            let filterBy = '';
            let filterCondition = 'on ' + this.getFilterQuery();
            let groupBy = 'server';
            switch (this.state.perspective) {
                case 0:
                    groupBy  = "cellName";
                    filterBy = "serverName,";
                    break;
                case 1:
                    groupBy = "serverName";
                    filterBy = "serviceName,";
                    break;
                case 2:
                    groupBy = "serviceName";
                    filterBy = "serviceMethod,";
                    break;
                case 3:
                    groupBy = "serviceMethod";
                    filterBy = "httpRespGroup,";
                    break;
                default:
                    groupBy = 'serverName';
                    break;
            }

            if (filterCondition.endsWith('on ')) {
                filterCondition = '';
                filterBy = '';
            }

            const dataProviderConfigs = _.cloneDeep(this.state.dataProviderConf);
            let { query } = dataProviderConfigs.configs.config.queryData;
            query = query
                .replace('{{filterCondition}}', filterCondition)
                .replace('{{groupBy}}', groupBy)
                .replace('{{groupBy}}', groupBy)
                .replace('{{filterBy}}', filterBy)
                .replace('{{per}}', this.state.per)
                .replace('{{from}}', this.state.fromDate)
                .replace('{{to}}', this.state.toDate);
            dataProviderConfigs.configs.config.queryData.query = query;
            super.getWidgetChannelManager()
                .subscribeWidget(this.props.id, this.handleDataReceived, dataProviderConfigs);
        }
    }

    /**
     * Renders widget.
     *
     * @return {XML} HTML content
     */
    render() {
        if (this.state.faultyProviderConf) {
            return (
                <div
                    style={{
                        padding: 24,
                    }}
                >
                    Cannot fetch provider configuration for HTTP Analytics Latency Over Time widget.
                </div>
            );
        }
        return (
            <div
                style={{
                    marginTop: '5px',
                    width: this.state.width,
                    height: this.state.height,
                }}
            >
                <VizG
                    config={this.state.chartConfig}
                    metadata={this.state.metadata}
                    data={this.state.data}
                    width={this.state.width}
                    height={this.state.height}
                    theme={this.props.muiTheme.name}
                />
            </div>
        );
    }
}

global.dashboard.registerWidget('HTTPAnalyticsLatencyOverTime', HTTPAnalyticsLatencyOverTime);
