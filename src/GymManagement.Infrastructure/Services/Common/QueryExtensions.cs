using System.Linq.Expressions;
using GymManagement.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services.Common;

public static class QueryExtensions
{
    /// <summary>Runs a COUNT query and a page query (OFFSET/FETCH). The query must already be ordered.</summary>
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(
        this IQueryable<T> query, PageQuery page, CancellationToken ct)
    {
        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page.Page - 1) * page.PageSize)
            .Take(page.PageSize)
            .ToListAsync(ct);

        return new PagedResult<T>(items, page.Page, page.PageSize, total);
    }

    public static IOrderedQueryable<T> OrderByDirection<T, TKey>(
        this IQueryable<T> query, Expression<Func<T, TKey>> key, bool descending) =>
        descending ? query.OrderByDescending(key) : query.OrderBy(key);

    /// <summary>JSON DateTimes without "Z" arrive as Unspecified; FitForge treats them as UTC.</summary>
    public static DateTime AsUtc(this DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
