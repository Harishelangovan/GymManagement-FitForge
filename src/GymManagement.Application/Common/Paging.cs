namespace GymManagement.Application.Common;

/// <summary>
/// Query-string parameters shared by every list endpoint: ?page=2&amp;pageSize=20&amp;search=rahul&amp;sortBy=name&amp;sortDirection=desc.
/// Out-of-range values are corrected instead of rejected.
/// </summary>
public class PageQuery
{
    public const int MaxPageSize = 100;

    private int _page = 1;
    private int _pageSize = 20;

    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = Math.Clamp(value, 1, MaxPageSize);
    }

    public string? Search { get; set; }
    public string? SortBy { get; set; }
    public string? SortDirection { get; set; }

    public bool Descending => string.Equals(SortDirection, "desc", StringComparison.OrdinalIgnoreCase);

    public string? SearchTerm => string.IsNullOrWhiteSpace(Search) ? null : Search.Trim();
}

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => TotalCount == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);

    public PagedResult<TOut> Map<TOut>(Func<T, TOut> map) =>
        new(Items.Select(map).ToList(), Page, PageSize, TotalCount);
}
