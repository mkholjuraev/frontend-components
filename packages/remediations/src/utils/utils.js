/* eslint-disable camelcase */
import React, { Fragment } from 'react';
import { CloseIcon, RedoIcon } from '@patternfly/react-icons';
import urijs from 'urijs';
import * as api from '../api';

export const CAN_REMEDIATE = 'remediations:remediation:write';

export const AUTO_REBOOT = 'auto-reboot';
export const HAS_MULTIPLES = 'has-multiples';
export const SELECT_PLAYBOOK = 'select-playbook';
export const SELECTED_RESOLUTIONS = 'selected-resolutions';
export const MANUAL_RESOLUTION = 'manual-resolution';
export const EXISTING_PLAYBOOK_SELECTED = 'existing-playbook-selected';
export const EXISTING_PLAYBOOK = 'existing-playbook';

// Get the current group since we can be mounted at two urls
export function getGroup () {
    const pathName = window.location.pathname.split('/');

    if (pathName[1] === 'beta') {
        return pathName[2];
    }

    return pathName[1];
}

export function remediationUrl (id) {
    return urijs(document.baseURI).segment(getGroup()).segment('remediations').segment(id).toString();
}

export const pluralize = (count, str) => count > 1 ? str + 's' : str;

const sortRecords = (records, sortByState) => records.sort(
    (a, b) => {
        const key = Object.keys(a)[sortByState.index];
        return (
            (a[key] > b[key] ? 1 :
                a[key] < b[key] ? -1 : 0)
                * (sortByState.direction === 'desc' ? -1 : 1)
        );
    }
);

export const buildRows = (records, sortByState) => sortRecords(records, sortByState).map((record, index) => ({
    cells: [
        record.action,
        <Fragment key={`${index}-description`}>
            <p key={`${index}-resolution`}>
                {record.resolution}
            </p>
            {record.alternate > 0 &&
                (
                    <p key={`${index}-alternate`}>{record.alternate} alternate {pluralize(record.alternate, 'resolution')}</p>
                )}
        </Fragment>,
        {
            title: record.needsReboot ? <Fragment><RedoIcon/>{' Yes'}</Fragment> : <Fragment><CloseIcon/>{' No'}</Fragment>,
            value: record.needsReboot
        },
        record.systemsCount
    ]
}));

export const getResolution = (issueId, formValues, resolutions) => {
    const issueResolutions = resolutions.find(r => r.id === issueId)?.resolutions || [];

    if (formValues[MANUAL_RESOLUTION] && issueId in formValues[SELECTED_RESOLUTIONS]) {
        return issueResolutions.filter(r => r.id === formValues[SELECTED_RESOLUTIONS][issueId]);
    }

    if (formValues[EXISTING_PLAYBOOK_SELECTED]) {
        const existing = formValues[EXISTING_PLAYBOOK]?.issues?.find(i => i.id === issueId);

        if (existing) {
            return issueResolutions.filter(r => r.id === existing.resolution.id);
        }
    }

    return issueResolutions;
};

function createNotification (id, name, isNewSwitch) {
    const verb = isNewSwitch ? 'created' : 'updated';

    return {
        variant: 'success',
        title: `Playbook ${verb}`,
        description: <span>You have successfully {verb} <a href={ remediationUrl(id) } >{ name }</a>.</span>,
        dismissable: true
    };
}

export const submitRemediation = (formValues, data, basePath, resolutions) => {
    const resolver = (id, name, isNewSwitch, onRemediationCreated) => onRemediationCreated({
        remediation: { id, name },
        getNotification: () => createNotification(id, name, isNewSwitch)
    });
    const issues = data.issues.map(({ id }) => ({
        id,
        resolution: getResolution(id, formValues, resolutions)?.[0]?.id,
        systems: data.systems
    }));
    const add = { issues, systems: data.systems };
    if (formValues[EXISTING_PLAYBOOK_SELECTED]) {
        const { id, name } = formValues[EXISTING_PLAYBOOK];
        api.patchRemediation(id, { add, auto_reboot: formValues[AUTO_REBOOT] }, basePath)
        .then(() => resolver(id, name, false, data.onRemediationCreated));
    } else {
        api.createRemediation({ name: formValues[SELECT_PLAYBOOK], add, auto_reboot: formValues[AUTO_REBOOT] }, basePath)
        .then(({ id }) => resolver(id, formValues[SELECT_PLAYBOOK], true, data.onRemediationCreated));
    }
};
