(() => {
    const state = {
        records: [],
        filteredRecords: [],
        currentQuery: '',
        selectedIds: new Set(),
        toastTimer: null,
        syncing: false
    };

    function getElements() {
        return {
            form: document.getElementById('plegado-mobile-search-form'),
            searchInput: document.getElementById('plegado-mobile-search'),
            scanButton: document.getElementById('plegado-mobile-scan-button'),
            syncStatus: document.getElementById('plegado-mobile-sync-status'),
            resultSummary: document.getElementById('plegado-mobile-result-summary'),
            resultList: document.getElementById('plegado-mobile-results'),
            selectAllBtn: document.getElementById('plegado-mobile-select-all'),
            formCard: document.getElementById('plegado-mobile-form-card'),
            selectionSummary: document.getElementById('plegado-mobile-selection-summary'),
            turnoInput: document.getElementById('plegado-mobile-turno'),
            supervisorSelect: document.getElementById('plegado-mobile-supervisor'),
            equipoInput: document.getElementById('plegado-mobile-equipo'),
            saveBtn: document.getElementById('plegado-mobile-save'),
            toast: document.getElementById('plegado-mobile-toast')
        };
    }

    function calculateTurno() {
        const hours = new Date().getHours();
        return (hours >= 7 && hours < 19) ? '1T' : '2T';
    }

    function isPlegadoDone(record) {
        return String(record && record.plegado_estado ? record.plegado_estado : '').trim().toUpperCase() === 'OK';
    }

    function formatRecordTitle(record) {
        return `${record.cliente || 'Sin cliente'} - ${TintoreriaUtils.formatOpPartida(record.op_tela, record.partida)}`;
    }

    function findRecordById(recordId) {
        return state.records.find((record) => String(record.id_registro || '') === String(recordId || '')) || null;
    }

    function setSyncStatus(message, isError = false) {
        const { syncStatus } = getElements();
        if (!syncStatus) return;
        syncStatus.textContent = message;
        syncStatus.style.color = isError ? 'var(--danger-text)' : 'var(--muted)';
    }

    function showToast(message) {
        const { toast } = getElements();
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('hidden');
        if (state.toastTimer) clearTimeout(state.toastTimer);
        state.toastTimer = window.setTimeout(() => {
            toast.classList.add('hidden');
        }, 3200);
    }

    function setRecords(records) {
        state.records = TintoreriaUtils.sortRecords(
            (records || []).map((record) => TintoreriaUtils.defaultRecord(record))
        );
    }

    function filterByExactOpPartida(query) {
        const normalizedQuery = TintoreriaUtils.normalizeOpPartidaSearchValue(query);
        if (!normalizedQuery) return [];
        return state.records.filter((record) => {
            const opPartida = TintoreriaUtils.formatOpPartida(record.op_tela, record.partida);
            return TintoreriaUtils.normalizeOpPartidaSearchValue(opPartida) === normalizedQuery;
        });
    }

    function getSelectableVisibleIds() {
        return state.filteredRecords
            .filter((record) => !isPlegadoDone(record))
            .map((record) => String(record.id_registro || ''))
            .filter(Boolean);
    }

    function pruneSelection() {
        const validIds = new Set(getSelectableVisibleIds());
        const nextSelection = new Set();
        state.selectedIds.forEach((recordId) => {
            if (validIds.has(recordId)) nextSelection.add(recordId);
        });
        state.selectedIds = nextSelection;
    }

    function renderResults() {
        const els = getElements();
        if (!els.resultList || !els.resultSummary || !els.formCard || !els.selectionSummary || !els.selectAllBtn) return;

        const query = state.currentQuery.trim();

        if (!query) {
            state.filteredRecords = [];
            state.selectedIds.clear();
            els.resultSummary.textContent = 'Ingresa una OP-PTDA para comenzar.';
            els.resultList.innerHTML = '<div class="empty-state">Ingresa una OP-PTDA para ver coincidencias exactas.</div>';
            els.formCard.classList.add('hidden');
            els.selectAllBtn.classList.add('hidden');
            return;
        }

        state.filteredRecords = filterByExactOpPartida(query);
        pruneSelection();

        if (!state.filteredRecords.length) {
            els.resultSummary.textContent = 'No se encontraron filas para esa OP-PTDA.';
            els.resultList.innerHTML = '<div class="empty-state">No se encontraron coincidencias exactas para la OP-PTDA ingresada.</div>';
            els.formCard.classList.add('hidden');
            els.selectAllBtn.classList.add('hidden');
            return;
        }

        const selectableIds = getSelectableVisibleIds();
        const selectedCount = selectableIds.filter((recordId) => state.selectedIds.has(recordId)).length;

        els.resultSummary.textContent = '';
        els.selectAllBtn.classList.toggle('hidden', selectableIds.length === 0);
        els.selectAllBtn.textContent =
            selectableIds.length > 0 && selectedCount === selectableIds.length
                ? 'Limpiar seleccion'
                : 'Seleccionar todo';

        els.resultList.innerHTML = state.filteredRecords.map((record) => {
            const recordId = String(record.id_registro || '');
            const checked = state.selectedIds.has(recordId) ? 'checked' : '';
            const done = isPlegadoDone(record);
            const selectedClass = !done && checked ? ' record-card-selected' : '';
            const doneClass = done ? ' record-card-approved' : '';
            const color = TintoreriaUtils.escapeHtml(TintoreriaUtils.formatColorLabel(record.color || 'Sin color'));
            const article = TintoreriaUtils.escapeHtml(record.articulo || 'Sin articulo');
            const ruta = TintoreriaUtils.escapeHtml(record.ruta || '—');

            const doneMetaLine = done
                ? buildDoneMetaLine(record)
                : '';

            const selectRow = done
                ? ''
                : `<div class="select-row"><label class="checkbox-label"><input type="checkbox" class="plegado-mobile-checkbox" data-record-id="${TintoreriaUtils.escapeHtml(recordId)}" ${checked}>Seleccionar</label></div>`;

            return `
                <article
                    class="record-card${done ? ' record-card-disabled' : ' record-card-selectable'}${doneClass}${selectedClass}"
                    ${done ? '' : `data-record-id="${TintoreriaUtils.escapeHtml(recordId)}"`}
                >
                    <div class="record-head">
                        <div class="record-title">${TintoreriaUtils.escapeHtml(formatRecordTitle(record))}</div>
                        <span class="status-pill ${done ? 'status-registered' : 'status-pending'}">
                            ${done ? 'Procesado' : 'Pendiente'}
                        </span>
                    </div>
                    <div class="record-detail-line"><strong>${color}</strong> <span>${article}</span></div>
                    <div class="record-meta">
                        <div class="meta-line"><strong>Kg(crudo):</strong> ${TintoreriaUtils.escapeHtml(record.peso_kg_crudo || '0')} <span class="meta-separator">|</span> <strong>#rollos/cntd:</strong> ${TintoreriaUtils.escapeHtml(record.cantidad_crudo || '0')}</div>
                        <div class="meta-line"><strong>Ruta:</strong> ${ruta}</div>
                        ${doneMetaLine}
                    </div>
                    ${selectRow}
                </article>
            `;
        }).join('');

        els.selectionSummary.textContent = '';
        els.formCard.classList.toggle('hidden', selectedCount === 0);
    }

    function buildDoneMetaLine(record) {
        const parts = [];
        const turno = String(record.plegado_turno || '').trim();
        const supervisor = String(record.plegado_supervisor || '').trim();
        const equipo = String(record.plegado_equipo || '').trim();
        const fecha = String(record.plegado_fecha || '').trim();
        if (turno) parts.push(`<strong>Turno:</strong> ${TintoreriaUtils.escapeHtml(turno)}`);
        if (supervisor) parts.push(`<strong>Supervisor:</strong> ${TintoreriaUtils.escapeHtml(supervisor)}`);
        if (equipo) parts.push(`<strong>Equipo:</strong> ${TintoreriaUtils.escapeHtml(equipo)}`);
        if (fecha) parts.push(`<strong>Fecha:</strong> ${TintoreriaUtils.escapeHtml(fecha)}`);
        return parts.length ? `<div class="meta-line">${parts.join('<span class="meta-separator">|</span>')}</div>` : '';
    }

    function updateSelected(recordId, checked) {
        if (!recordId) return;
        if (checked) {
            state.selectedIds.add(recordId);
        } else {
            state.selectedIds.delete(recordId);
        }
        renderResults();
    }

    function toggleSelected(recordId) {
        if (!recordId) return;
        updateSelected(recordId, !state.selectedIds.has(recordId));
    }

    function toggleSelectAll() {
        const selectableIds = getSelectableVisibleIds();
        if (!selectableIds.length) return;
        const allSelected = selectableIds.every((recordId) => state.selectedIds.has(recordId));
        if (allSelected) {
            selectableIds.forEach((recordId) => state.selectedIds.delete(recordId));
        } else {
            selectableIds.forEach((recordId) => state.selectedIds.add(recordId));
        }
        renderResults();
    }

    function search(query) {
        state.currentQuery = String(query || '').trim().toUpperCase();
        renderResults();
    }

    async function handleScan() {
        const els = getElements();
        if (!window.TintoreriaQR || typeof TintoreriaQR.scanQrCode !== 'function') {
            showToast('No se encontro el lector QR.');
            return;
        }
        if (els.scanButton) els.scanButton.disabled = true;
        try {
            const rawValue = await TintoreriaQR.scanQrCode();
            const opPartida = TintoreriaQR.normalizeScannedOpPartida(rawValue);
            els.searchInput.value = opPartida;
            search(opPartida);
        } catch (error) {
            const message = error && error.message ? error.message : 'No se pudo escanear el QR.';
            if (message !== 'Escaneo cancelado.') showToast(message);
        } finally {
            if (els.scanButton) els.scanButton.disabled = false;
        }
    }

    function mergeUpdatedRecord(updatedRecord) {
        if (!updatedRecord || !updatedRecord.id_registro) return;
        const targetId = String(updatedRecord.id_registro);
        state.records = state.records.map((record) => {
            if (String(record.id_registro || '') !== targetId) return record;
            return TintoreriaUtils.defaultRecord({ ...record, ...updatedRecord });
        });
    }

    async function handleProcesar() {
        const els = getElements();
        const selectedIds = Array.from(state.selectedIds);
        const supervisor = String(els.supervisorSelect ? els.supervisorSelect.value : '').trim();
        const equipoRaw = String(els.equipoInput.value || '').trim();
        const equipo = TintoreriaUtils.sanitizePlegadoEquipo(equipoRaw);
        const turno = String(els.turnoInput.value || calculateTurno()).trim() || calculateTurno();

        if (!selectedIds.length) {
            showToast('Selecciona al menos una fila.');
            return;
        }

        if (!supervisor) {
            showToast('Selecciona un supervisor antes de procesar.');
            if (els.supervisorSelect) els.supervisorSelect.focus();
            return;
        }

        if (!equipo) {
            showToast('Ingresa el equipo antes de procesar.');
            els.equipoInput.focus();
            return;
        }

        if (!TintoreriaUtils.isValidPlegadoEquipo(equipo)) {
            showToast('Equipo solo admite letras y un guion sin espacios (ej: A-B).');
            els.equipoInput.focus();
            return;
        }

        els.saveBtn.disabled = true;
        els.saveBtn.textContent = 'Procesando...';

        try {
            const updatesList = selectedIds.map((recordId) => {
                if (!findRecordById(recordId)) return Promise.resolve(null);

                const changes = {
                    plegado_turno: turno,
                    plegado_supervisor: supervisor,
                    plegado_equipo: equipo,
                    plegado_estado: 'OK',
                    plegado_fecha: TintoreriaUtils.formatDateForUi(new Date())
                };

                return TintoreriaAPI.updateRecord(recordId, changes);
            });

            const responses = await Promise.all(updatesList);
            responses.forEach((response) => {
                if (response && response.record) mergeUpdatedRecord(response.record);
            });

            state.selectedIds.clear();
            if (els.supervisorSelect) els.supervisorSelect.value = '';
            els.equipoInput.value = '';
            renderResults();
            showToast(`Plegado procesado en ${selectedIds.length} fila(s).`);
        } catch (error) {
            showToast(error && error.message ? error.message : 'No se pudo procesar el plegado.');
        } finally {
            els.saveBtn.disabled = false;
            els.saveBtn.textContent = 'PROCESAR';
        }
    }

    function isEditableTarget(target) {
        return target instanceof Element &&
            Boolean(target.closest('input, textarea, select, [contenteditable="true"], label'));
    }

    function dismissKeyboardIfNeeded(target) {
        if (isEditableTarget(target)) return;
        const activeElement = document.activeElement;
        if (!(activeElement instanceof HTMLElement)) return;
        if (!activeElement.matches('input, textarea, select, [contenteditable="true"]')) return;
        activeElement.blur();
    }

    function bindEvents() {
        const els = getElements();
        if (!els.form || !els.searchInput || !els.resultList || !els.saveBtn || !els.selectAllBtn) return;

        document.addEventListener('pointerdown', (event) => {
            dismissKeyboardIfNeeded(event.target);
        });

        els.form.addEventListener('submit', (event) => {
            event.preventDefault();
            search(els.searchInput.value);
        });

        els.searchInput.addEventListener('input', () => {
            search(els.searchInput.value);
        });

        els.resultList.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (!target.classList.contains('plegado-mobile-checkbox')) return;
            updateSelected(target.dataset.recordId || '', target.checked);
        });

        els.resultList.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('.checkbox-label') || target.closest('.plegado-mobile-checkbox')) return;
            const card = target.closest('.record-card-selectable');
            if (!card) return;
            toggleSelected(card.getAttribute('data-record-id') || '');
        });

        els.selectAllBtn.addEventListener('click', toggleSelectAll);
        els.saveBtn.addEventListener('click', handleProcesar);
        if (els.scanButton) els.scanButton.addEventListener('click', handleScan);
        els.turnoInput.value = calculateTurno();
    }

    async function hydrateFromCache() {
        if (!window.TintoreriaAPI || typeof TintoreriaAPI.getCachedRecords !== 'function') return false;
        const cached = TintoreriaAPI.getCachedRecords();
        if (!cached || !Array.isArray(cached.records) || !cached.records.length) return false;
        setRecords(cached.records);
        setSyncStatus(`Mostrando cache local (${cached.records.length} registros). Sincronizando...`);
        renderResults();
        return true;
    }

    async function refreshRemoteRecords() {
        if (!window.TintoreriaAPI || typeof TintoreriaAPI.listRecords !== 'function') {
            setSyncStatus('No se encontro la API configurada.', true);
            return;
        }
        state.syncing = true;
        setSyncStatus('Sincronizando datos con la web...');
        try {
            const response = await TintoreriaAPI.listRecords();
            setRecords(response.records || []);
            renderResults();
            setSyncStatus('');
        } catch (error) {
            setSyncStatus(error && error.message ? error.message : 'No se pudo sincronizar la informacion.', true);
        } finally {
            state.syncing = false;
        }
    }

    async function init() {
        bindEvents();
        await hydrateFromCache();
        await refreshRemoteRecords();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
