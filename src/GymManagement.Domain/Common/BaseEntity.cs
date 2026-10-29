namespace GymManagement.Domain.Common;

/// <summary>Base type for every domain table that uses an integer identity key.</summary>
public abstract class BaseEntity
{
    public int Id { get; set; }
}

/// <summary>
/// Entities whose creation and last-update times are tracked.
/// The values are set automatically by AppDbContext.SaveChangesAsync, always in UTC.
/// </summary>
public abstract class AuditableEntity : BaseEntity
{
    public DateTime CreatedUtc { get; set; }
    public DateTime? UpdatedUtc { get; set; }
}
