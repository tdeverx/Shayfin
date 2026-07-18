class HeaderContext {
	filterOpen = $state(false);
	hasActiveFilters = $state(false);

	openFilters() {
		this.filterOpen = true;
	}

	resetFilters() {
		this.filterOpen = false;
		this.hasActiveFilters = false;
	}
}

export const headerContext = new HeaderContext();
